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

  const handleChange = (field: keyof Inputs) => (event: ChangeEvent<HTMLInputElement>) => {
    setInputs((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult(calculateScores(inputs));
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
      </main>
    </div>
  );
}
