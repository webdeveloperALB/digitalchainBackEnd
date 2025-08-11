"use client"

import { useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

type Status = "PASSED" | "FAILED" | "WARN"
type TestItem = {
  test: string
  status: Status
  message: string
  humanNote: string
  meta?: Record<string, any>
}

const REQUIRED_TABLES = [
  "profiles",
  "crypto_balances",
  "euro_balances",
  "cad_balances",
  "usd_balances",
  "transactions",
  "transfers",
  "deposits",
  "payments",
  "cards",
  "crypto_transactions",
  "external_accounts",
]

const ADMIN_PASSWORD = "123456789"

export default function DatabaseTest() {
  const [testResults, setTestResults] = useState<TestItem[]>([])
  const [loading, setLoading] = useState(false)
  const [rlsRows, setRlsRows] = useState<any[] | null>(null)
  const [extRows, setExtRows] = useState<any[] | null>(null)
  const [consRows, setConsRows] = useState<any[] | null>(null)
  const [estRows, setEstRows] = useState<any[] | null>(null)
  const [dbInfo, setDbInfo] = useState<any[] | null>(null)

  const [showPwd, setShowPwd] = useState(false)
  const [pwd, setPwd] = useState("")
  const [pwdError, setPwdError] = useState<string | null>(null)

  const [realtimeMs, setRealtimeMs] = useState<number | null>(null)
  const realtimeStartRef = useRef<number | null>(null)

  const projectInfo = useMemo(() => {
    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "")
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    const maskedAnon = anon ? anon.slice(0, 6) + "…" + anon.slice(-4) : ""
    return { url, maskedAnon }
  }, [])

  const add = (arr: TestItem[], item: TestItem) => arr.push(item)

  const pingLatency = async (n = 5) => {
    const times: number[] = []
    for (let i = 0; i < n; i++) {
      const t0 = performance.now()
      const { error } = await supabase.from("profiles").select("*", { head: true, count: "exact" })
      const dt = performance.now() - t0
      if (error) throw error
      times.push(dt)
      // brief jitter
      await new Promise(r => setTimeout(r, 80))
    }
    times.sort((a, b) => a - b)
    const p50 = Math.round(times[Math.floor(times.length * 0.5)])
    const p95 = Math.round(times[Math.floor(times.length * 0.95) - 1] ?? times.at(-1)!)
    return { p50, p95, samples: times.map(t => Math.round(t)) }
  }

  const realtimeProbe = async () => {
    try {
      const ch = supabase.channel("db-check-rt")
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Realtime timeout")), 4000)
        ch.on("broadcast", { event: "ping" }, (_payload) => {
          if (realtimeStartRef.current != null) {
            const ms = Math.round(performance.now() - realtimeStartRef.current)
            setRealtimeMs(ms)
          }
          clearTimeout(timeout)
          ch.unsubscribe()
          resolve()
        }).subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            // send ping
            realtimeStartRef.current = performance.now()
            await ch.send({ type: "broadcast", event: "ping", payload: { t: Date.now() } })
          }
        })
      })
      return true
    } catch {
      setRealtimeMs(null)
      return false
    }
  }

  const runChecks = async () => {
    setLoading(true)
    const results: TestItem[] = []

    // 0) Environment sanity
    const envOk = Boolean(projectInfo.url && projectInfo.maskedAnon)
    add(results, {
      test: "Environment Variables",
      status: envOk ? "PASSED" : "FAILED",
      message: envOk
        ? `URL ok, anon key present (${projectInfo.maskedAnon})`
        : "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
      humanNote: envOk
        ? "The app knows how to reach the database."
        : "App is missing its database settings. A developer must set the two NEXT_PUBLIC_ variables."
    })

    // 1) Auth details
    try {
      const { data: s } = await supabase.auth.getSession()
      const { data, error } = await supabase.auth.getUser()
      const user = data?.user ?? null
      const expiresAt = s?.session?.expires_at ? s.session.expires_at * 1000 : null
      const msLeft = expiresAt ? expiresAt - Date.now() : null
      const minLeft = msLeft != null ? Math.max(0, Math.round(msLeft / 60000)) : null

      add(results, {
        test: "User Authentication",
        status: error || !user ? "FAILED" : "PASSED",
        message: error
          ? error.message
          : user
            ? `User: ${user.email ?? user.id}${minLeft != null ? ` (token ~${minLeft}m left)` : ""}`
            : "No user/session",
        humanNote: user
          ? "You are signed in. Protected tables should be accessible according to your policies."
          : "You are NOT signed in. Protected tables may look locked."
      })
    } catch (e: any) {
      add(results, {
        test: "User Authentication",
        status: "FAILED",
        message: e.message,
        humanNote: "We couldn't check who you are. Try signing in again."
      })
    }

    // 2) DB info
    try {
      const { data, error } = await supabase.rpc("get_db_info")
      if (error) throw error
      setDbInfo(data)
      const row = data?.[0]
      add(results, {
        test: "Database Info",
        status: "PASSED",
        message: `${row?.server_version?.split(" ")[0] ?? "Postgres"} • ${row?.db_size_pretty} • TZ ${row?.timezone} • role ${row?.current_role}`,
        humanNote: "Basic database details: version, size, timezone and role in use."
      })
    } catch (e: any) {
      add(results, {
        test: "Database Info",
        status: "FAILED",
        message: e.message,
        humanNote: "We couldn't read the DB metadata."
      })
    }

    // 3) RLS overview
    try {
      const { data, error } = await supabase.rpc("get_rls_overview")
      if (error) throw error
      setRlsRows(data || [])

      const withPolicies = (data || []).filter((r: any) => (r.policy_count ?? 0) > 0)
      const disabledWithPolicies = withPolicies.filter((r: any) => !r.rls_enabled)
      const publicTables = (data || []).filter((r: any) => !r.rls_enabled && (!r.policy_count || r.policy_count === 0))

      add(results, {
        test: "RLS Overview",
        status: "PASSED",
        message: `Loaded ${data?.length ?? 0} tables`,
        humanNote: "RLS = Row Level Security. 'Enabled' means table rows are protected by policies."
      })

      if (disabledWithPolicies.length > 0) {
        add(results, {
          test: "RLS Activation",
          status: "WARN",
          message: `${disabledWithPolicies.length} table(s) have policies but RLS is disabled`,
          humanNote: "Rules exist but are not enforced. Enable RLS to activate them.",
          meta: { tables: disabledWithPolicies.map((x: any) => x.table_name) }
        })
      }

      if (publicTables.length > 0) {
        add(results, {
          test: "Public Tables",
          status: "WARN",
          message: `${publicTables.length} table(s) look public (no RLS & no policies)`,
          humanNote: "These are readable with the public key. Fine for lookup data; review for sensitive info.",
          meta: { tables: publicTables.map((x: any) => x.table_name) }
        })
      }
    } catch (e: any) {
      add(results, {
        test: "RLS Overview",
        status: "FAILED",
        message: e.message,
        humanNote: "We couldn't read the security rules from the database."
      })
    }

    // 4) Table existence + simple read
    for (const table of REQUIRED_TABLES) {
      try {
        const { error } = await supabase.from(table).select("*").limit(1)
        const ok = !error
        add(results, {
          test: `Table read: ${table}`,
          status: ok ? "PASSED" : "FAILED",
          message: ok ? "Readable (no error)" : error!.message,
          humanNote: ok
            ? "This table can be read with the current access. If it should be private, enable RLS."
            : "Locked for the current user. If access is expected, sign in or adjust policies."
        })
      } catch (e: any) {
        add(results, {
          test: `Table read: ${table}`,
          status: "FAILED",
          message: e.message,
          humanNote: "We couldn't read this table with the current access."
        })
      }
    }

    // 5) Extensions
    try {
      const { data, error } = await supabase.rpc("get_extensions")
      if (error) throw error
      setExtRows(data)
      add(results, {
        test: "Extensions",
        status: "PASSED",
        message: `${data.length} extension(s) installed`,
        humanNote: "Shows installed Postgres extensions (e.g., pgcrypto, vector, http)."
      })
    } catch (e: any) {
      add(results, {
        test: "Extensions",
        status: "FAILED",
        message: e.message,
        humanNote: "We couldn't list DB extensions."
      })
    }

    // 6) Constraints overview
    try {
      const { data, error } = await supabase.rpc("get_constraints_overview")
      if (error) throw error
      setConsRows(data)
      const tablesWithNoPK = (data || []).filter((r: any) => (r.pk_count ?? 0) === 0)
      add(results, {
        test: "Constraints",
        status: "PASSED",
        message: `Got constraints for ${data.length} table(s); ${tablesWithNoPK.length} without a primary key`,
        humanNote: "Primary keys help data integrity and performance. Zero-PK tables might be logs/feeds—review if unexpected."
      })
    } catch (e: any) {
      add(results, {
        test: "Constraints",
        status: "FAILED",
        message: e.message,
        humanNote: "We couldn't read table constraints."
      })
    }

    // 7) Row-count estimates
    try {
      const { data, error } = await supabase.rpc("get_table_estimates")
      if (error) throw error
      setEstRows(data)
      const heavy = (data || []).filter((r: any) => Number(r.est_rows) > 1_000_000).map((r: any) => r.table_name)
      add(results, {
        test: "Row Count (est.)",
        status: "PASSED",
        message: `Loaded fast estimates for ${data.length} table(s)`,
        humanNote: heavy.length
          ? `Some tables are very large (est. >1M rows): ${heavy.slice(0, 5).join(", ")}`
          : "Table sizes look modest based on estimates."
      })
    } catch (e: any) {
      add(results, {
        test: "Row Count (est.)",
        status: "FAILED",
        message: e.message,
        humanNote: "We couldn't load row-count estimates."
      })
    }

    // 8) Latency benchmark (p50/p95)
    try {
      const bench = await pingLatency(5)
      add(results, {
        test: "Latency Benchmark",
        status: "PASSED",
        message: `p50 ~${bench.p50}ms • p95 ~${bench.p95}ms • samples ${bench.samples.join(", ")}`,
        humanNote: "Lower is better. p95 shows worst-case of these quick probes."
      })
    } catch (e: any) {
      add(results, {
        test: "Latency Benchmark",
        status: "FAILED",
        message: (e as Error).message,
        humanNote: "We couldn't measure round-trip latency."
      })
    }

    // 9) Realtime round-trip
    const rtOK = await realtimeProbe()
    add(results, {
      test: "Realtime Connectivity",
      status: rtOK && realtimeMs != null ? "PASSED" : "FAILED",
      message: rtOK && realtimeMs != null ? `Broadcast loop ~${realtimeMs}ms` : "Realtime test failed",
      humanNote: rtOK ? "Realtime channel works." : "Realtime seems blocked or misconfigured."
    })

    setTestResults(results)
    setLoading(false)
  }

  const asJson = useMemo(
    () =>
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          project: projectInfo,
          results: testResults,
          rls: rlsRows,
          dbInfo,
          extensions: extRows,
          constraints: consRows,
          estimates: estRows,
          realtimeMs
        },
        null,
        2
      ),
    [testResults, rlsRows, dbInfo, extRows, consRows, estRows, realtimeMs, projectInfo]
  )

  const download = () => {
    const blob = new Blob([asJson], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `db-check-${new Date().toISOString().slice(0, 19)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const beginRun = () => {
    setPwd("")
    setPwdError(null)
    setShowPwd(true)
  }

  const confirmRun = async () => {
    if (pwd !== ADMIN_PASSWORD) {
      setPwdError("Incorrect password. Try again.")
      return
    }
    setShowPwd(false)
    await runChecks()
  }

  const StatusBadge = ({ status }: { status: Status }) => {
    if (status === "PASSED") return <Badge className="bg-green-600 hover:bg-green-600">PASSED</Badge>
    if (status === "WARN") return <Badge className="bg-yellow-600 hover:bg-yellow-600">WARN</Badge>
    return <Badge className="bg-red-600 hover:bg-red-600">FAILED</Badge>
  }

  return (
    <>
      <Card className="w-full max-w-4xl mx-auto mt-8">
        <CardHeader className="space-y-2">
          <CardTitle>Database Diagnostics</CardTitle>
          <p className="text-sm text-muted-foreground">
            Read-only checks. No data is modified.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button onClick={beginRun} disabled={loading} className="w-full bg-[#F26623] hover:bg-[#E55A1F]">
              {loading ? "Running Tests..." : "Run Database Tests"}
            </Button>
            {testResults.length > 0 && (
              <Button variant="outline" onClick={download}>Download JSON</Button>
            )}
          </div>

          {testResults.length > 0 && (
            <>
              <div className="space-y-3">
                {testResults.map((r, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded border ${r.status === "PASSED"
                        ? "border-green-200 bg-green-50"
                        : r.status === "WARN"
                          ? "border-yellow-200 bg-yellow-50"
                          : "border-red-200 bg-red-50"
                      }`}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="font-medium">{r.test}</div>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{r.message}</p>
                    <p className="text-sm mt-2 p-2 rounded bg-white/60">
                      <span className="font-medium">What this means: </span>{r.humanNote}
                    </p>
                  </div>
                ))}
              </div>

              {/* RLS & Policies table */}
              {rlsRows && (
                <section className="mt-6">
                  <h3 className="font-semibold mb-2">RLS & Policies (technical)</h3>
                  <div className="overflow-x-auto border rounded">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="text-left p-2">Table</th>
                          <th className="text-left p-2">RLS</th>
                          <th className="text-left p-2">Forced</th>
                          <th className="text-left p-2">Policies</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rlsRows.map((r: any) => (
                          <tr key={r.table_name} className="odd:bg-muted/10 align-top">
                            <td className="p-2 font-medium">{r.table_name}</td>
                            <td className="p-2">
                              {r.rls_enabled
                                ? <Badge variant="secondary" className="bg-green-100 text-green-800">enabled</Badge>
                                : <Badge variant="secondary" className="bg-red-100 text-red-800">disabled</Badge>}
                            </td>
                            <td className="p-2">{r.rls_forced ? "yes" : "no"}</td>
                            <td className="p-2 whitespace-pre-wrap">{r.policies_summary || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Extensions */}
              {extRows && (
                <section className="mt-6">
                  <h3 className="font-semibold mb-2">Installed Extensions</h3>
                  <div className="overflow-x-auto border rounded">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/30">
                        <tr><th className="p-2 text-left">Name</th><th className="p-2 text-left">Version</th><th className="p-2 text-left">Schema</th></tr>
                      </thead>
                      <tbody>
                        {extRows.map((e: any) => (
                          <tr key={`${e.name}-${e.version}`} className="odd:bg-muted/10">
                            <td className="p-2">{e.name}</td>
                            <td className="p-2">{e.version}</td>
                            <td className="p-2">{e.schema}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Constraints */}
              {consRows && (
                <section className="mt-6">
                  <h3 className="font-semibold mb-2">Constraints Overview</h3>
                  <div className="overflow-x-auto border rounded">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/30">
                        <tr><th className="p-2 text-left">Table</th><th className="p-2 text-left">PK</th><th className="p-2 text-left">FK</th><th className="p-2 text-left">Unique</th></tr>
                      </thead>
                      <tbody>
                        {consRows.map((c: any) => (
                          <tr key={c.table_name} className="odd:bg-muted/10">
                            <td className="p-2">{c.table_name}</td>
                            <td className="p-2">{c.pk_count}</td>
                            <td className="p-2">{c.fk_count}</td>
                            <td className="p-2">{c.unique_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Estimates */}
              {estRows && (
                <section className="mt-6">
                  <h3 className="font-semibold mb-2">Row Count Estimates</h3>
                  <div className="overflow-x-auto border rounded">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/30">
                        <tr><th className="p-2 text-left">Table</th><th className="p-2 text-left">Estimated Rows</th></tr>
                      </thead>
                      <tbody>
                        {estRows.map((t: any) => (
                          <tr key={t.table_name} className="odd:bg-muted/10">
                            <td className="p-2">{t.table_name}</td>
                            <td className="p-2">{Number(t.est_rows).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Estimates come from PostgreSQL statistics (fast, approximate). They do not scan whole tables.
                  </p>
                </section>
              )}

              <pre className="text-xs bg-muted/20 p-3 rounded whitespace-pre-wrap mt-6">
                {asJson}
              </pre>
            </>
          )}
        </CardContent>
      </Card>

      {/* Password Dialog */}
      <Dialog open={showPwd} onOpenChange={setShowPwd}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Confirm admin check</DialogTitle>
            <DialogDescription>Enter the admin passcode to run diagnostics.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <label htmlFor="admin-pass" className="text-sm font-medium">Passcode</label>
            <Input
              id="admin-pass"
              type="password"
              value={pwd}
              onChange={(e) => { setPwd(e.target.value); setPwdError(null) }}
              placeholder="Enter passcode"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") confirmRun() }}
            />
            {pwdError && <p className="text-sm text-red-600">{pwdError}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={confirmRun} className="bg-[#F26623] hover:bg-[#E55A1F]">
              Run Tests
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
