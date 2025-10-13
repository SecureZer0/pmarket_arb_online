import React from 'react';
import { MarketMatch } from '../../../../types/market';

interface Props {
  match: MarketMatch;
}

export default function DetailsView({ match }: Props) {
  return (
    <div className="text-sm text-[#EEEDED]">
      {/* AI Analysis Notes at the top */}
      {match.notes && (
        <div className="p-4 border-b border-[#403F3D]">
          {(() => {
            try {
              const parsed = parseNotes(match.notes);
              return parsed;
            } catch (error) {
              return (
                <>
                  <div className="text-[#A1A1A1] mb-2 text-sm">AI Analysis Notes:</div>
                  <div className="text-[#EEEDED] text-base leading-relaxed">{match.notes}</div>
                </>
              );
            }
          })()}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 p-4">
        {/* KALSHI SIDE */}
        <div>
          <div className="text-[#A1A1A1] mb-2">KALSHI</div>

          {/* Main info for Kalshi */}
          <div className="mb-4">
            <div className="cursor-pointer text-base font-medium text-[#EEEDED] mb-2" onClick={() => window.open(match.market_a_url || '#', '_blank')}>
              {match.market_a_title}
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-[#A1A1A1] text-xs mb-1">Close Conditions:</div>
                <div className="text-[#EEEDED] text-sm break-words mb-[4px]">Primary: {match.market_a_platform_data?.rules_primary || 'N/A'}</div>
                <div className="text-[#EEEDED] text-sm break-words mb-[4px]">Secondary: {match.market_a_platform_data?.rules_secondary || 'N/A'}</div>
                <div className="text-[#EEEDED] text-sm break-words mb-[4px]">Early Close: {match.market_a_platform_data?.early_close_condition || 'N/A'}</div>
              </div>
              <div>
                <div className="text-[#A1A1A1] text-xs mb-1">End Date:</div>
                <div className="text-[#EEEDED] text-sm">{formatEndDate(match.market_a_end_time)}</div>
              </div>
            </div>
          </div>

          {/* Kalshi details */}
          <div className="space-y-1">
            {/* Kalshi Platform Data */}
            {match.market_a_platform_data && (
              <div className="mt-3 pt-3 border-t border-[#403F3D]">
                <div className="text-[#A1A1A1] text-xs mb-2">Additional Details:</div>

                <div className="space-y-1 text-xs">
                  <div className="truncate">URL: <a className="text-blue-400 underline" href={match.market_a_url || '#'} target="_blank" rel="noreferrer">Go to market →</a></div>
                  <div>Outcome: {match.market_a_outcome_type || 'N/A'}</div>
                  <div>Start: {formatDateTime(match.market_a_start_time)}</div>
                  <div>End: {formatDateTime(match.market_a_end_time)}</div>
                  {match.market_a_platform_data?.event_title && (
                    <div>Event: {match.market_a_platform_data.event_title}</div>
                  )}
                  {match.market_a_platform_data?.event_subtitle && (
                    <div>Subtitle: {match.market_a_platform_data.event_subtitle}</div>
                  )}
                  {match.market_a_platform_data?.event_category && (
                    <div>Category: {match.market_a_platform_data.event_category}</div>
                  )}
                  {match.market_a_platform_data?.yes_subtitle && (
                    <div>Yes: {match.market_a_platform_data.yes_subtitle}</div>
                  )}
                  {match.market_a_platform_data?.no_subtitle && (
                    <div>No: {match.market_a_platform_data.no_subtitle}</div>
                  )}
                  {match.market_a_platform_data?.market_type && (
                    <div>Type: {match.market_a_platform_data.market_type}</div>
                  )}
                  {match.market_a_platform_data?.market_type && (
                    <div>External ID: {match.market_a_external_id}</div>
                  )}
                  {match.market_id_a && (
                    <div>Internal ID: {match.market_id_a}</div>
                  )}
                  {match.market_a_platform_data?.early_close_condition && (
                    <div className="text-yellow-400">Early Close: {match.market_a_platform_data.early_close_condition}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* POLYMARKET SIDE */}
        <div>
          <div className="text-[#A1A1A1] mb-2">POLYMARKET</div>

          {/* Main info for Polymarket */}
          <div className="mb-4">
            <div className="cursor-pointer text-base font-medium text-[#EEEDED] mb-2" onClick={() => window.open(match.market_b_url || '#', '_blank')}>
              {match.market_b_title}
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-[#A1A1A1] text-xs mb-1">Close Condition:</div>
                <div className="text-[#EEEDED] text-sm break-words">{match.market_b_close_condition || 'N/A'}</div>
              </div>
              <div>
                <div className="text-[#A1A1A1] text-xs mb-1">End Date:</div>
                <div className="text-[#EEEDED] text-sm">{formatEndDate(match.market_b_end_time)}</div>
              </div>
            </div>
          </div>

          {/* Polymarket details */}
          <div className="space-y-1">
            {/* Polymarket Platform Data */}
            {match.market_b_platform_data && (
              <div className="mt-3 pt-3 border-t border-[#403F3D]">
                <div className="text-[#A1A1A1] text-xs mb-2">Additional Details:</div>
                <div className="space-y-1 text-xs">
                  <div className="truncate">URL: <a className="text-blue-400 underline" href={match.market_b_url || '#'} target="_blank" rel="noreferrer">Go to market →</a></div>
                  <div>Outcome: {match.market_b_outcome_type || 'N/A'}</div>
                  <div>Start: {formatDateTime(match.market_b_start_time)}</div>
                  <div>End: {formatDateTime(match.market_b_end_time)}</div>
                  {match.market_b_platform_data.question && (
                    <div>Question / Title: {match.market_b_platform_data.question}</div>
                  )}
                  {match.market_b_platform_data.outcomes && (
                    <div>Outcomes: {match.market_b_platform_data.outcomes}</div>
                  )}
                  {match.market_b_platform_data.group_item_title && (
                    <div>Group Item: {match.market_b_platform_data.group_item_title}</div>
                  )}
                  {match.market_b_platform_data.clobTokenIds && (
                    <div>CLob Token IDs: {match.market_b_platform_data.clobTokenIds}</div>
                  )}
                  {match.market_id_b && (
                    <div>Internal ID: {match.market_id_b}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-[#403F3D] p-4 text-xs text-[#A1A1A1]">
        Created: {formatDate(match.created_at)}
      </div>
    </div>
  );
}

function formatDate(dateString: string | null) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString();
}

function formatDateTime(dateString: string | null) {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function formatEndDate(dateString: string | null) {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  const day = d.getDate();
  const suffix = getDaySuffix(day);
  return `${time}, ${d.toLocaleDateString('en-US', { month: 'short' })} ${day}${suffix} ${d.getFullYear()}`;
}

function getDaySuffix(day: number) {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function parseNotes(notes: string) {
  // Replace "market a" and "market b" references with platform names
  let processedNotes = notes
    .replace(/\bmarket a\b/gi, 'Kalshi')
    .replace(/\bmarket b\b/gi, 'Polymarket');

  const lowerNotes = processedNotes.toLowerCase();

  // Check if notes contain ai_status and close_condition_ai_status
  if (lowerNotes.includes('ai_status:') && lowerNotes.includes('close_condition_ai_status:')) {
    // Extract ai_status section
    const aiStatusMatch = processedNotes.match(/ai_status:\s*(.*?)(?=\s*close_condition_ai_status:|$)/i);
    const closeConditionMatch = processedNotes.match(/close_condition_ai_status:\s*(.*?)$/i);

    const aiStatusText = aiStatusMatch ? aiStatusMatch[1].trim() : '';
    const closeConditionText = closeConditionMatch ? closeConditionMatch[1].trim() : '';

    return (
      <div className="space-y-4">
        <div>
          <div className="text-[#A1A1A1] text-sm mb-2 font-medium">Market Match AI Analysis:</div>
          <div className="text-[#EEEDED] text-base leading-relaxed">{aiStatusText}</div>
        </div>
        <div>
          <div className="text-[#A1A1A1] text-sm mb-2 font-medium">Close Condition AI Analysis:</div>
          <div className="text-[#EEEDED] text-base leading-relaxed">{closeConditionText}</div>
        </div>
      </div>
    );
  }

  // If not separated, show as one block
  return (
    <div className="space-y-3">
      <div className="text-[#A1A1A1] text-sm mb-2 font-medium">Market Match AI Analysis:</div>
      <div className="text-[#EEEDED] text-base leading-relaxed">{processedNotes}</div>
    </div>
  );
}


