"use client";

import { useState } from "react";

type Patient = {
  patient_id?: unknown;
  id?: unknown;
  blood_pressure?: unknown;
  temperature?: unknown;
  age?: unknown;
};

type AlertLists = {
  highRisk: string[];
  fever: string[];
  dataQuality: string[];
  totalPatients: number;
};

const HIGH_FEVER_THRESHOLD = 101; // Spec reads as ≥101°F for high fever

const parseNumber = (value: string): number | null => {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const getBloodPressureScore = (systolicValue: string, diastolicValue: string) => {
  const systolic = parseNumber(systolicValue);
  const diastolic = parseNumber(diastolicValue);
  if (systolic === null || diastolic === null) return 0;

  if (systolic >= 140 || diastolic >= 90) return 4;
  if (
    (systolic >= 130 && systolic <= 139) ||
    (diastolic >= 80 && diastolic <= 89)
  )
    return 3;
  if (systolic >= 120 && systolic <= 129 && diastolic < 80) return 2;
  if (systolic < 120 && diastolic < 80) return 1;
  return 0;
};

const getTemperatureScore = (temperatureValue: string) => {
  const temperature = parseNumber(temperatureValue);
  if (temperature === null) return 0;

  if (temperature >= HIGH_FEVER_THRESHOLD) return 2;
  if (temperature >= 99.6 && temperature <= 100.9) return 1;
  if (temperature <= 99.5) return 0;
  return 0;
};

const getAgeScore = (ageValue: string) => {
  const age = parseNumber(ageValue);
  if (age === null || age < 0) return 0;

  if (age > 65) return 2;
  if (age >= 40) return 1;
  if (age < 40) return 1;
  return 0;
};

export default function Home() {
  const [alerts, setAlerts] = useState<AlertLists>({
    highRisk: [],
    fever: [],
    dataQuality: [],
    totalPatients: 0,
  });
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientError, setPatientError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    ok: boolean;
    message: string;
    details?: unknown;
  } | null>(null);

  const parseBloodPressureReading = (raw: unknown) => {
    if (typeof raw !== "string") {
      return { systolic: null, diastolic: null, valid: false };
    }
    const trimmed = raw.trim();
    if (!trimmed.includes("/")) {
      return { systolic: null, diastolic: null, valid: false };
    }
    const [systolicRaw, diastolicRaw] = trimmed.split("/");
    if (!systolicRaw || !diastolicRaw) {
      return { systolic: null, diastolic: null, valid: false };
    }
    const systolic = parseNumber(systolicRaw);
    const diastolic = parseNumber(diastolicRaw);
    const valid = systolic !== null && diastolic !== null;
    return {
      systolic: valid ? String(systolic) : null,
      diastolic: valid ? String(diastolic) : null,
      valid,
    };
  };

  const parseTemperatureValue = (raw: unknown): number | null => {
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
    if (typeof raw === "string") return parseNumber(raw);
    return null;
  };

  const parseAgeValue = (raw: unknown): number | null => {
    if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? raw : null;
    if (typeof raw === "string") {
      const parsed = parseNumber(raw);
      if (parsed === null || parsed < 0) return null;
      return parsed;
    }
    return null;
  };

  const normalizePatient = (patient: Patient) => {
    const id =
      typeof patient.patient_id === "string"
        ? patient.patient_id
        : typeof patient.id === "string"
          ? patient.id
          : null;
    if (!id) return null;

    const bp = parseBloodPressureReading(patient.blood_pressure);
    const temperature = parseTemperatureValue(patient.temperature);
    const age = parseAgeValue(patient.age);

    const bpScore = bp.valid
      ? getBloodPressureScore(bp.systolic ?? "", bp.diastolic ?? "")
      : 0;
    const tempScore = getTemperatureScore(temperature !== null ? String(temperature) : "");
    const ageScore = getAgeScore(age !== null ? String(age) : "");

    const hasInvalid = !bp.valid || temperature === null || age === null;

    return {
      id,
      bpScore,
      tempScore,
      ageScore,
      total: bpScore + tempScore + ageScore,
      temperature,
      hasInvalid,
    };
  };

  const fetchPatients = async () => {
    setLoadingPatients(true);
    setPatientError(null);
    setSubmitResult(null);
    try {
      const response = await fetch("/api/patients?limit=20&maxPages=10", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const payload = (await response.json()) as { data?: unknown[] };
      const records = Array.isArray(payload.data) ? payload.data : [];

      const highRisk: string[] = [];
      const fever: string[] = [];
      const dataQuality: string[] = [];
      const seen = new Set<string>();

      records.forEach((entry) => {
        const normalized = normalizePatient(entry as Patient);
        if (!normalized) return;
        if (seen.has(normalized.id)) return;
        seen.add(normalized.id);

        if (normalized.total >= 4) {
          highRisk.push(normalized.id);
        }
        if (normalized.temperature !== null && normalized.temperature >= 99.6) {
          fever.push(normalized.id);
        }
        if (normalized.hasInvalid) {
          dataQuality.push(normalized.id);
        }
      });

      setAlerts({
        highRisk,
        fever,
        dataQuality,
        totalPatients: seen.size,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setPatientError(message);
    } finally {
      setLoadingPatients(false);
    }
  };

  const submitAlerts = async () => {
    if (alerts.totalPatients === 0) {
      setSubmitResult({
        ok: false,
        message: "Fetch patients before submitting.",
      });
      return;
    }

    setSubmitting(true);
    setSubmitResult(null);
    try {
      const response = await fetch("/api/submit-assessment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          high_risk_patients: alerts.highRisk,
          fever_patients: alerts.fever,
          data_quality_issues: alerts.dataQuality,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `Submission failed (${response.status})${text ? `: ${text}` : ""}`,
        );
      }

      const payload = (await response.json()) as { message?: string };
      setSubmitResult({
        ok: true,
        message: payload?.message ?? "Submitted successfully",
        details: payload,
      });
    } catch (error) {
      setSubmitResult({
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Patient Alerts</h1>
          <p className="text-sm text-slate-600">
            Fetches all patients via the server proxy, scores them client-side, and lets you submit
            the alert lists.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Fetch & Submit</h2>
              <p className="text-xs text-slate-500">Retrieve patients, score them, then submit.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={fetchPatients}
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={loadingPatients}
              >
                {loadingPatients ? "Fetching..." : "Fetch Patients"}
              </button>
              <button
                type="button"
                onClick={submitAlerts}
                className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-200"
                disabled={submitting || loadingPatients || alerts.totalPatients === 0}
              >
                {submitting ? "Submitting..." : "Submit Alerts"}
              </button>
            </div>
          </div>

          {patientError ? (
            <p className="text-sm text-red-600">Error: {patientError}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  High Risk (≥4)
                </p>
                <p className="text-base font-semibold text-slate-900">
                  {alerts.highRisk.length}
                </p>
                <p className="mt-1 text-xs text-slate-500 break-words">
                  {alerts.highRisk.length > 0 ? alerts.highRisk.join(", ") : "None"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Fever (≥99.6°F)
                </p>
                <p className="text-base font-semibold text-slate-900">{alerts.fever.length}</p>
                <p className="mt-1 text-xs text-slate-500 break-words">
                  {alerts.fever.length > 0 ? alerts.fever.join(", ") : "None"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Data Quality Issues
                </p>
                <p className="text-base font-semibold text-slate-900">
                  {alerts.dataQuality.length}
                </p>
                <p className="mt-1 text-xs text-slate-500 break-words">
                  {alerts.dataQuality.length > 0 ? alerts.dataQuality.join(", ") : "None"}
                </p>
              </div>
            </div>
          )}
          <p className="text-xs text-slate-500">
            Total patients processed: {alerts.totalPatients}
          </p>
          {submitResult && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                submitResult.ok
                  ? "border-green-200 bg-green-50 text-green-900"
                  : "border-red-200 bg-red-50 text-red-900"
              }`}
            >
              <p className="font-medium">{submitResult.message}</p>
              {submitResult.details ? (
                <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">
                  {JSON.stringify(submitResult.details, null, 2)}
                </pre>
              ) : null}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
