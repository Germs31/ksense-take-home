"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";

type Inputs = {
  systolic: string;
  diastolic: string;
  temperature: string;
  age: string;
};

type ScoreBreakdown = {
  bloodPressure: number;
  temperature: number;
  age: number;
  total: number;
};

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

const calculateScores = (inputs: Inputs): ScoreBreakdown => {
  const bloodPressure = getBloodPressureScore(inputs.systolic, inputs.diastolic);
  const temperature = getTemperatureScore(inputs.temperature);
  const age = getAgeScore(inputs.age);
  return {
    bloodPressure,
    temperature,
    age,
    total: bloodPressure + temperature + age,
  };
};

export default function Home() {
  const [inputs, setInputs] = useState<Inputs>({
    systolic: "",
    diastolic: "",
    temperature: "",
    age: "",
  });
  const [result, setResult] = useState<ScoreBreakdown | null>(null);
  const [alerts, setAlerts] = useState<AlertLists>({
    highRisk: [],
    fever: [],
    dataQuality: [],
    totalPatients: 0,
  });
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientError, setPatientError] = useState<string | null>(null);

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

  const handleChange = (field: keyof Inputs) => (event: ChangeEvent<HTMLInputElement>) => {
    setInputs((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult(calculateScores(inputs));
  };

  const fetchPatients = async () => {
    setLoadingPatients(true);
    setPatientError(null);
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Patient Risk Calculator</h1>
          <p className="text-sm text-slate-600">
            Enter vitals and age to compute the total risk score. Missing or invalid values are
            treated as 0 for that category.
          </p>
        </header>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-800">Systolic (mmHg)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={inputs.systolic}
                  onChange={handleChange("systolic")}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  placeholder="e.g., 128"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-800">Diastolic (mmHg)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={inputs.diastolic}
                  onChange={handleChange("diastolic")}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  placeholder="e.g., 84"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-800">Temperature (°F)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={inputs.temperature}
                  onChange={handleChange("temperature")}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  placeholder="e.g., 100.4"
                />
                <p className="text-xs text-slate-500">Normal ≤99.5, Low 99.6-100.9, High ≥101.</p>
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-800">Age (years)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputs.age}
                  onChange={handleChange("age")}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  placeholder="e.g., 72"
                />
                <p className="text-xs text-slate-500">Under 40 or 40-65: 1 point, Over 65: 2 points.</p>
              </label>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                If systolic/diastolic fall in different BP stages, the higher stage score is used.
              </p>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                Calculate Risk
              </button>
            </div>
          </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Risk Score</h2>
        {result ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-semibold text-slate-900">{result.total}</span>
                <span className="text-sm text-slate-500">Total</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Blood Pressure</p>
                  <p className="text-base font-medium text-slate-900">{result.bloodPressure} pts</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Temperature</p>
                  <p className="text-base font-medium text-slate-900">{result.temperature} pts</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Age</p>
                  <p className="text-base font-medium text-slate-900">{result.age} pts</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Enter values and calculate to see the score.</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Patient Alerts</h2>
              <p className="text-xs text-slate-500">
                Fetches all patients via the server proxy, then scores them client-side.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchPatients}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={loadingPatients}
            >
              {loadingPatients ? "Fetching..." : "Fetch Patients"}
            </button>
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
        </section>
      </main>
    </div>
  );
}
