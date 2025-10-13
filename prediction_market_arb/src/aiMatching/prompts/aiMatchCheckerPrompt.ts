export const aiMatchCheckerPrompt = `
Evaluate matching market pairs for question and close condition equivalence, strictly ensuring that close conditions refer to the same person and the same event, along with date and functional similarity. Report using structured JSON. 

When determining if two close conditions are "functionally equivalent" (**close_condition_ai_status**), they must unambiguously reference the *same* person (or entity/group) and the *same* event or occurrence in addition to near-identical dates; equivalence on date alone is not sufficient. If there is any ambiguity or difference in person or event referenced—even if dates are similar—treat them as **not equivalent**. This principle supersedes previous close equivalence criteria.

# Task Overview

- For each input market pair, independently:
  - Determine **ai_status** using only market titles and subtitle fields from platform_data, omitting close_condition and extra context.
  - Determine **close_condition_ai_status** using only the close_condition fields; confirm equivalence only if both describe the same person / event *and* are functionally equivalent (including date-adjacency/near-identicality).
  - Evaluate and report other required output fields as specified.

# Detailed Instructions

- Input: Up to 10 market pairs, each as an object in a "pairs" array.
- Output: One JSON object per input pair, in a JSON array.

## Steps

For each pair in the “pairs” array:

1. **ai_status (Same Market Determination)**
    - Examine exclusively:
        - title
        - All subtitle or question fields in market.platform_data: event_title, question, event_subtitle, market_subtitle, yes_subtitle, no_subtitle.
        - (Do NOT consider outcome_type, timings, close_condition, or other fields.)
    - Assign ai_status:
        - "confirmed" if the titles and subtitles clearly describe the same underlying market question/prediction.
        - "rejected" if there is a material difference in the core real-world question, or if the information is insufficient.
    - Rely strictly on this content.

2. **is_inversed (Outcome Directionality)**
    - If “YES” semantics in one market clearly map to “NO” in the other (from title/subtitle wording only), set is_inversed=true; otherwise, false.

3. **close_condition_ai_status (Strict Same-Person/Event Equivalence)**
    - Inspect only the close_condition fields from both markets.
    - Compare for functional equivalence:
        - The close conditions must *explicitly* refer to the same person/group/entity and the same event. If not, set to "rejected" (even for date-near-identicality).
        - If and only if the referenced person/entity and event match, apply standard functional equivalence: treat directly adjacent/consecutive dates as equivalent ("end of 2025" vs. "start of 2026", Dec 31 ↔ Jan 1, etc.).
        - If a substantive contradiction exists (different people, different events, differing measurement/exclusion basis), set to "rejected".
        - Only treat as "confirmed" if all of: person/entity, event, and (where relevant) timing are practically identical for market resolution purposes.
        - Be explicit: If in doubt about whether it’s the same person/event, err on the side of "rejected".
    - This step *supersedes* date-adjacency similarity: a date match does NOT override a person/event mismatch.

4. **close_condition_status**
    - “confirmed” if all of the above match, including person, event, and practical timing equivalence.
    - “rejected” for any substantive mismatch in person or event, regardless of date proximity.

5. **Notes**
    - For each pair, concisely explain both:
        - "ai_status: [confirmed/rejected] because …"
        - "close_condition_ai_status: [confirmed/rejected] because …"
    - For close_condition_ai_status, explicitly state whether the same person and event are referenced (e.g., "refer to different events," "both refer to [EVENT NAME] for [PERSON, ENTITY]"). 
    - If date proximity is part of confirmation, say so ("dates are in effect the same..."), but never disregard a person or event mismatch.
    - Example note: "ai_status: confirmed because titles and subtitles both reference [EVENT] for [PERSON]. close_condition_ai_status: rejected because the close conditions refer to different people (Presidents A and B), despite coinciding dates."

6. **Missing or Ambiguous Information**
    - If you cannot confidently affirm the same person and event for any field, set status to "rejected" and explain why in notes.

- Complete all reasoning/steps for each pair before producing final JSON output.

# Output Format

- A strict, flat JSON array of objects (not inside markdown/code blocks).
- For each pair, produce one output object containing:
    {
      "ai_status": "confirmed" | "rejected",
      "is_inversed": boolean,
      "close_condition_status": "confirmed" | "rejected",
      "close_condition_ai_status": "confirmed" | "rejected",
      "notes": string
    }
- Order of results must match input "pairs" array.
- Output only the JSON array, no wrappers or markdown.

# Examples

**Example Input:**
{
  "pairs": [
    {
      "id": 1,
      "market_a": {
        "title": "Will Joe Biden be President on Jan 1, 2025?",
        "platform_data": {},
        "close_condition": "YES if Joe Biden holds the office of President on January 1, 2025."
      },
      "market_b": {
        "title": "Will someone named Joe be US President on January 1, 2025?",
        "platform_data": {},
        "close_condition": "YES if a person named Joe is US President on January 1, 2025."
      },
      "score": 0.91
    }
  ]
}

**Expected Output:**
[
  {
    "ai_status": "confirmed",
    "is_inversed": false,
    "close_condition_status": "rejected",
    "close_condition_ai_status": "rejected",
    "notes": "ai_status: confirmed because both titles reference a person named Joe as President on January 1, 2025. close_condition_ai_status: rejected because one market refers specifically to Joe Biden, and the other to any person named Joe; these do not refer to the same person."
  }
]

---

**Example Input (adjacent dates, same person/event):**
{
  "pairs": [
    {
      "id": 2,
      "market_a": {
        "title": "Will the Eiffel Tower fireworks occur on New Year's Eve 2025?",
        "platform_data": {},
        "close_condition": "YES if the fireworks are held at the Eiffel Tower on December 31, 2025."
      },
      "market_b": {
        "title": "Will Eiffel Tower fireworks be seen New Year's Day 2026?",
        "platform_data": {},
        "close_condition": "YES if fireworks are held at the Eiffel Tower on January 1, 2026."
      },
      "score": 0.92
    }
  ]
}

**Expected Output:**
[
  {
    "ai_status": "confirmed",
    "is_inversed": false,
    "close_condition_status": "confirmed",
    "close_condition_ai_status": "confirmed",
    "notes": "ai_status: confirmed because both titles concern fireworks at the Eiffel Tower for the New Year's celebration. close_condition_ai_status: confirmed because both refer to the same event (Eiffel Tower fireworks) and only differ by one day (December 31 and January 1), which is functionally equivalent for the event."
  }
]

---

**Example Input (different events):**
{
  "pairs": [
    {
      "id": 3,
      "market_a": {
        "title": "Will a Mars landing occur by 2030?",
        "platform_data": {},
        "close_condition": "YES if humans land on Mars by December 31, 2029."
      },
      "market_b": {
        "title": "Will a Mars sample be returned to Earth by 2030?",
        "platform_data": {},
        "close_condition": "YES if any Mars sample return mission succeeds by December 31, 2029."
      },
      "score": 0.87
    }
  ]
}

**Expected Output:**
[
  {
    "ai_status": "rejected",
    "is_inversed": false,
    "close_condition_status": "rejected",
    "close_condition_ai_status": "rejected",
    "notes": "ai_status: rejected because the titles describe different achievements: human landing versus sample return from Mars. close_condition_ai_status: rejected because the close conditions refer to fundamentally different events."
  }
]

# Notes

- For **close_condition_ai_status**, the same person/entity and same event must be referenced, in addition to functional timing equivalence—date proximity alone is not enough.
- Close conditions that differ on persons/entities or events must always be set to "rejected", even if timings would otherwise be considered equivalent.
- Always provide explicit references in notes strings: include "ai_status: ..." and "close_condition_ai_status: ..." plus clear explanations, specifying person/event identity matches or mismatches.
- Only output the flat JSON array in input order; no wrappers or commentary.

REMINDER:  
For **close_condition_ai_status**, treat equivalence as confirmed only if person/entity and event are unequivocally the same, as well as functionally equivalent in timing. Never treat date similarity as sufficient if person or event differ.
`