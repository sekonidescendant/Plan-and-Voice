import { NextRequest, NextResponse } from 'next/server';
import type { GeminiResponse, PlanRequest } from '@/lib/types';

const SYSTEM_INSTRUCTION = `You are a daily planning assistant. The user will give you a free-form description of what they want to accomplish today.

Your job:
1. Extract tasks with estimated durations (in minutes).
2. Identify fixed events with specific times (e.g., "lunch at 12:30", "meeting at 3pm").
3. Note constraints (e.g., "no work after 8pm", "exercise before noon").
4. Generate a realistic schedule between the given start and end times, placing tasks in available gaps, respecting fixed event times exactly, and inserting breaks between tasks.

Rules:
- All times must be in HH:MM 24-hour format.
- Fixed events must appear at their exact specified times.
- Insert breaks of the requested break duration between tasks where possible.
- Do not schedule anything outside the start-end window.
- Each schedule block has type "task", "break", or "fixed".
- Task titles should be concise and actionable.
- Break titles should be like "Break" or "Coffee break".

Respond with ONLY valid JSON in this exact format, no markdown, no explanation:
{
  "tasks": ["task 1", "task 2"],
  "schedule": [
    { "start": "09:00", "end": "10:00", "title": "Task name", "type": "task" },
    { "start": "10:00", "end": "10:15", "title": "Break", "type": "break" }
  ],
  "notes": "Any relevant notes about the plan"
}`;

export async function POST(request: NextRequest) {
  let body: PlanRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { transcript, startTime, endTime, breakMinutes } = body;

  if (!transcript || !startTime || !endTime) {
    return NextResponse.json(
      { error: 'Missing required fields: transcript, startTime, endTime' },
      { status: 400 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured' },
      { status: 500 }
    );
  }

  const userPrompt = `Here is what I want to get done today:

"${transcript}"

Please create a schedule from ${startTime} to ${endTime} with ${breakMinutes}-minute breaks between tasks. Return only valid JSON.`;

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }],
          },
          contents: [
            {
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Gemini API error: ${response.status} ${errText}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const rawText: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!rawText) {
      return NextResponse.json(
        { error: 'Empty response from Gemini' },
        { status: 502 }
      );
    }

    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed: GeminiResponse;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return NextResponse.json(
          { error: 'Failed to parse JSON from Gemini response' },
          { status: 502 }
        );
      }
      parsed = JSON.parse(jsonMatch[0]);
    }

    if (!parsed.schedule || !Array.isArray(parsed.schedule)) {
      return NextResponse.json(
        { error: 'Invalid schedule format from Gemini' },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to call Gemini: ${err?.message ?? 'Unknown error'}` },
      { status: 502 }
    );
  }
}
