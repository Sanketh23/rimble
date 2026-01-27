#!/usr/bin/env node
/**
 * Build a daily question from NBA Stats API:
 * "Top N players with most career playoff triple-doubles"
 *
 * Outputs SQL insert for Supabase.
 *
 * Usage:
 *   node tools/build-playoff-td3-question.mjs --date 2026-01-27 --top 20 --start 1996 --end 2025 --include-ties
 */

const BASE = "https://stats.nba.com/stats";

const args = process.argv.slice(2);
const getArg = (name, fallback = null) => {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
};

const hasFlag = (name) => args.includes(`--${name}`);

const questionDate = getArg("date");
const topN = Number(getArg("top", "20"));
const startYear = Number(getArg("start", "1996"));
const endYear = Number(getArg("end", "2025"));
const includeTies = hasFlag("include-ties");

if (!questionDate) {
  console.error("Missing --date YYYY-MM-DD");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Origin": "https://www.nba.com",
  "Referer": "https://www.nba.com/",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

const fetchJson = async (endpoint, params) => {
  const url = new URL(`${BASE}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NBA stats error ${res.status}: ${text}`);
  }
  return res.json();
};

const seasonString = (year) => {
  const next = String(year + 1).slice(-2);
  return `${year}-${next}`;
};

const seasonRange = (start, end) => {
  const list = [];
  for (let y = start; y <= end; y += 1) {
    list.push(seasonString(y));
  }
  return list;
};

const teamLogoMap = {
  ATL: "hawks.png",
  BKN: "nets.png",
  BOS: "celtics.png",
  CHA: "hornets.png",
  CHI: "bulls.png",
  CLE: "cavaliers.png",
  DAL: "mavericks.png",
  DEN: "nuggets.png",
  DET: "pistons.png",
  GSW: "warriors.png",
  HOU: "rockets.png",
  IND: "pacers.png",
  LAC: "clippers.png",
  LAL: "lakers.png",
  MEM: "grizzlies.png",
  MIA: "heat.png",
  MIL: "bucks.png",
  MIN: "timberwolves.png",
  NOP: "pelicans.png",
  NYK: "knicks.png",
  OKC: "thunder.png",
  ORL: "magic.png",
  PHI: "76ers.png",
  PHX: "suns.png",
  POR: "trailblazers.png",
  SAC: "kings.png",
  SAS: "spurs.png",
  TOR: "raptors.png",
  UTA: "jazz.png",
  WAS: "wizards.png",
  SEA: "supersonics.png",
  KCK: "royals.png",
  KCR: "royals.png",
};

const getResultSet = (json) => {
  if (json.resultSets && Array.isArray(json.resultSets)) {
    return json.resultSets[0];
  }
  if (json.resultSet) return json.resultSet;
  throw new Error("Unexpected NBA stats response format.");
};

const sumPlayoffTripleDoubles = async (seasons) => {
  const totals = new Map();

  for (const season of seasons) {
    const data = await fetchJson("leaguedashplayerstats", {
      Season: season,
      SeasonType: "Playoffs",
      PerMode: "Totals",
      MeasureType: "Base",
      LeagueID: "00",
      LastNGames: "0",
      Month: "0",
      OpponentTeamID: "0",
      PaceAdjust: "N",
      PlusMinus: "N",
      Rank: "N",
      Conference: "",
      Division: "",
      GameScope: "",
      PlayerExperience: "",
      PlayerPosition: "",
      StarterBench: "",
    });

    const resultSet = getResultSet(data);
    const headers = resultSet.headers;
    const rows = resultSet.rowSet;
    const idxPlayerId = headers.indexOf("PLAYER_ID");
    const idxPlayerName = headers.indexOf("PLAYER_NAME");
    const idxTD3 = headers.indexOf("TD3");

    if (idxTD3 === -1) {
      throw new Error("TD3 column not found in leaguedashplayerstats.");
    }

    rows.forEach((row) => {
      const td3 = Number(row[idxTD3] ?? 0);
      if (td3 <= 0) return;
      const playerId = row[idxPlayerId];
      const playerName = row[idxPlayerName];
      const key = String(playerId);
      const existing = totals.get(key) ?? {
        playerId,
        playerName,
        td3: 0,
      };
      existing.td3 += td3;
      totals.set(key, existing);
    });

    // Respect rate limits
    await sleep(800);
  }

  return Array.from(totals.values()).sort((a, b) => b.td3 - a.td3);
};

const getPlayerInfo = async (playerId) => {
  const data = await fetchJson("commonplayerinfo", {
    PlayerID: playerId,
    LeagueID: "00",
  });
  const resultSet = getResultSet(data);
  const headers = resultSet.headers;
  const row = resultSet.rowSet[0];
  const pick = (field) => row[headers.indexOf(field)];
  return {
    playerId,
    playerName: pick("DISPLAY_FIRST_LAST"),
    teamAbbr: pick("TEAM_ABBREVIATION"),
    rosterStatus: pick("ROSTERSTATUS"),
  };
};

const getTenure = async (playerId) => {
  const data = await fetchJson("playercareerstats", {
    PlayerID: playerId,
    PerMode: "Totals",
    LeagueID: "00",
  });
  const resultSet = data.resultSets?.find(
    (set) => set.name === "SeasonTotalsRegularSeason"
  );
  if (!resultSet) return null;
  const headers = resultSet.headers;
  const rows = resultSet.rowSet;
  const idxTeam = headers.indexOf("TEAM_ABBREVIATION");
  const idxSeason = headers.indexOf("SEASON_ID");
  const idxGP = headers.indexOf("GP");

  const teamTotals = new Map();

  rows.forEach((row) => {
    const team = row[idxTeam];
    const seasonId = String(row[idxSeason]);
    const gp = Number(row[idxGP] ?? 0);
    if (!team || team === "TOT") return;
    const existing = teamTotals.get(team) ?? {
      team,
      gp: 0,
      seasons: [],
    };
    existing.gp += gp;
    existing.seasons.push(seasonId);
    teamTotals.set(team, existing);
  });

  const best = Array.from(teamTotals.values()).sort(
    (a, b) => b.gp - a.gp
  )[0];
  if (!best) return null;

  const years = best.seasons
    .map((seasonId) => Number(seasonId.slice(0, 4)))
    .filter(Boolean)
    .sort((a, b) => a - b);

  const range =
    years.length > 0 ? `${years[0]}–${years[years.length - 1] + 1}` : "";

  return {
    team: best.team,
    years: range,
  };
};

const buildSql = (payload) => {
  const json = (value) => JSON.stringify(value);
  return `insert into questions (
  question_date,
  question,
  options,
  option_meta,
  max_misses,
  rules_note,
  retired_players,
  option_logos
)
values (
  '${payload.questionDate}',
  '${payload.question.replace(/'/g, "''")}',
  '${json(payload.options).replace(/'/g, "''")}'::jsonb,
  '${json(payload.optionMeta).replace(/'/g, "''")}'::jsonb,
  ${payload.maxMisses},
  '${payload.rulesNote.replace(/'/g, "''")}',
  '${json(payload.retiredPlayers).replace(/'/g, "''")}'::jsonb,
  '${json(payload.optionLogos).replace(/'/g, "''")}'::jsonb
);`;
};

const main = async () => {
  const seasons = seasonRange(startYear, endYear);
  const leaders = await sumPlayoffTripleDoubles(seasons);

  let trimmed = leaders.slice(0, topN);
  if (includeTies && leaders.length > topN) {
    const cutoff = leaders[topN - 1]?.td3 ?? 0;
    trimmed = leaders.filter((entry) => entry.td3 >= cutoff);
  }

  const options = [];
  const optionMeta = [];
  const optionLogos = [];
  const retiredPlayers = [];

  for (const entry of trimmed) {
    const info = await getPlayerInfo(entry.playerId);
    const tenure = await getTenure(entry.playerId);
    const isActive = info.rosterStatus === "Active";
    const teamAbbr = isActive ? info.teamAbbr : tenure?.team;
    const logo = teamLogoMap[teamAbbr] ?? "unknown.png";
    const years = tenure?.years ?? "";

    options.push(`${info.playerName}${isActive ? " *" : ""}`);
    optionMeta.push(years);
    optionLogos.push(logo);
    if (!isActive) {
      retiredPlayers.push(info.playerName);
    }

    await sleep(800);
  }

  const sql = buildSql({
    questionDate,
    question:
      "Can you list the top 20 NBA players with the most career playoff triple-doubles",
    options,
    optionMeta,
    maxMisses: 5,
    rulesNote:
      "Active players show current team logo and are marked with *.\nRetired players show most-tenured team with years played there.",
    retiredPlayers,
    optionLogos,
  });

  console.log(sql);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
