// Sample market data. Edit freely: yes = current "Yes" probability (%), volume in ₽, closes = YYYY-MM-DD.
const CATEGORIES = [
  { id: "world",  name: "World Economics" },
  { id: "russia", name: "Russian Economics" },
  { id: "sport",  name: "Sport" },
  { id: "politics", name: "Russian Politics" }
];

const EVENTS = [
  // ---- World Economics ----
  { cat: "world", q: "Will Brent crude close above $90 on 31 Dec 2026?", yes: 27, vol: 4200000, closes: "2026-12-31" },
  { cat: "world", q: "Will the US Fed cut rates at its December 2026 meeting?", yes: 58, vol: 6100000, closes: "2026-12-16" },
  { cat: "world", q: "Will gold trade above $4,500/oz before 2027?", yes: 41, vol: 3800000, closes: "2026-12-31" },
  { cat: "world", q: "Will Bitcoin exceed $150,000 by 31 Dec 2026?", yes: 19, vol: 9500000, closes: "2026-12-31" },
  { cat: "world", q: "Will the S&P 500 end 2026 higher than it started?", yes: 71, vol: 5300000, closes: "2026-12-31" },
  { cat: "world", q: "Will EUR/USD be above 1.20 on 31 Dec 2026?", yes: 22, vol: 2100000, closes: "2026-12-31" },
  { cat: "world", q: "Will China's 2026 GDP growth be reported at 5% or higher?", yes: 47, vol: 2700000, closes: "2027-01-20" },
  { cat: "world", q: "Will the US enter a recession (NBER-declared) by mid-2027?", yes: 24, vol: 3300000, closes: "2027-06-30" },
  { cat: "world", q: "Will OPEC+ announce a production cut before 1 Jan 2027?", yes: 35, vol: 1900000, closes: "2026-12-31" },
  { cat: "world", q: "Will global wheat prices hit a 12-month high this winter?", yes: 29, vol: 880000, closes: "2027-02-28" },
  { cat: "world", q: "Will Nvidia remain the world's most valuable company on 31 Dec 2026?", yes: 52, vol: 4700000, closes: "2026-12-31" },

  // ---- Russian Economics ----
  { cat: "russia", q: "Will the Bank of Russia cut its key rate at the next board meeting?", yes: 63, vol: 7200000, closes: "2026-12-18" },
  { cat: "russia", q: "Will USD/RUB (official CBR rate) be above 100 on 31 Dec 2026?", yes: 46, vol: 6400000, closes: "2026-12-31" },
  { cat: "russia", q: "Will Russia's annual inflation be below 7% in December 2026?", yes: 38, vol: 3900000, closes: "2027-01-15" },
  { cat: "russia", q: "Will the MOEX Index close above 3,000 on 31 Dec 2026?", yes: 44, vol: 5100000, closes: "2026-12-31" },
  { cat: "russia", q: "Will the CBR key rate be at or below 14% on 31 Dec 2026?", yes: 51, vol: 4300000, closes: "2026-12-31" },
  { cat: "russia", q: "Will Russia's 2026 GDP growth exceed 1.5%?", yes: 33, vol: 2400000, closes: "2027-02-15" },
  { cat: "russia", q: "Will the Urals oil price average above $60 in Q4 2026?", yes: 49, vol: 2900000, closes: "2027-01-05" },
  { cat: "russia", q: "Will the unemployment rate stay below 3% through December 2026?", yes: 78, vol: 1500000, closes: "2027-01-31" },
  { cat: "russia", q: "Will VAT be raised again in the 2027 budget cycle?", yes: 18, vol: 1300000, closes: "2026-12-31" },
  { cat: "russia", q: "Will Sberbank report record annual net profit for 2026?", yes: 57, vol: 3100000, closes: "2027-02-10" },
  { cat: "russia", q: "Will average Moscow rent rise more than 10% year-on-year by end of 2026?", yes: 36, vol: 760000, closes: "2026-12-31" },

  // ---- Sport ----
  { cat: "sport", q: "Will Zenit St. Petersburg win the 2026/27 Russian Premier League?", yes: 34, vol: 2800000, closes: "2027-05-30" },
  { cat: "sport", q: "Will Spartak Moscow finish in the top 3 of the RPL this season?", yes: 31, vol: 1200000, closes: "2027-05-30" },
  { cat: "sport", q: "Will CSKA Moscow win the 2026/27 Russian Cup?", yes: 17, vol: 640000, closes: "2027-05-31" },
  { cat: "sport", q: "Will SKA St. Petersburg reach the KHL Gagarin Cup final?", yes: 26, vol: 1700000, closes: "2027-04-20" },
  { cat: "sport", q: "Will CSKA Moscow win the KHL Gagarin Cup this season?", yes: 14, vol: 1100000, closes: "2027-04-30" },
  { cat: "sport", q: "Will a Russian player win the 2027 Australian Open (men's singles)?", yes: 21, vol: 2300000, closes: "2027-01-31" },
  { cat: "sport", q: "Will Daniil Medvedev reach a Grand Slam final in 2027?", yes: 23, vol: 1900000, closes: "2027-09-15" },
  { cat: "sport", q: "Will Alexander Ovechkin score 900 career NHL goals this season?", yes: 42, vol: 3400000, closes: "2027-04-15" },
  { cat: "sport", q: "Will Russia's national football team be allowed back into FIFA competitions by end of 2026?", yes: 12, vol: 4600000, closes: "2026-12-31" },
  { cat: "sport", q: "Will Russian athletes compete under their national flag at the 2028 Olympics?", yes: 15, vol: 3700000, closes: "2027-12-31" },
  { cat: "sport", q: "Will Lokomotiv Moscow finish above Dynamo Moscow in the RPL table?", yes: 49, vol: 520000, closes: "2027-05-30" },

  // ---- Russian Politics ----
  { cat: "politics", q: "Will Putin's annual Direct Line be held in December 2026?", yes: 81, vol: 1600000, closes: "2026-12-31" },
  { cat: "politics", q: "Will the 2027 federal budget be adopted with a deficit under 2% of GDP?", yes: 45, vol: 1800000, closes: "2026-12-31" },
  { cat: "politics", q: "Will a new Prime Minister be appointed before 1 Jan 2027?", yes: 9, vol: 2200000, closes: "2026-12-31" },
  { cat: "politics", q: "Will Russia and Ukraine sign a formal ceasefire agreement by end of 2026?", yes: 13, vol: 8900000, closes: "2026-12-31" },
  { cat: "politics", q: "Will Putin and Trump hold an in-person meeting before 1 Jan 2027?", yes: 22, vol: 6800000, closes: "2026-12-31" },
  { cat: "politics", q: "Will the EU adopt a new sanctions package against Russia before 1 Jan 2027?", yes: 83, vol: 5400000, closes: "2026-12-31" },
  { cat: "politics", q: "Will a major Russian federal minister be replaced before 1 Jan 2027?", yes: 28, vol: 1400000, closes: "2026-12-31" },
  { cat: "politics", q: "Will Moscow host a BRICS leaders' summit-level event in 2027?", yes: 11, vol: 690000, closes: "2027-12-31" },
  { cat: "politics", q: "Will Russia hold a nationwide referendum before the end of 2027?", yes: 5, vol: 870000, closes: "2027-12-31" },
  { cat: "politics", q: "Will Sergey Sobyanin remain Mayor of Moscow through 31 Dec 2026?", yes: 96, vol: 1100000, closes: "2026-12-31" }
];

EVENTS.forEach((e, i) => (e.id = i + 1));
