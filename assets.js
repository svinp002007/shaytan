// Каталог активов для раздела «Перпы». Цены в списках — примерные стартовые значения для демо-симуляции.
// Когда подключён живой источник (бейдж Live), цена заменяется настоящей. Состав и порядок приблизительные.
// Формат строки: ТИКЕР|Название|цена[|ключ=значение]  (yf= тикер на Yahoo, moex= код на Мосбирже)
const ASSET_LISTS = {
  index: `SPX|S&P 500|6800|yf=^GSPC
NDX|Nasdaq 100|24500|yf=^NDX
DJI|Dow Jones|47000|yf=^DJI
IMOEX|Индекс Мосбиржи|2700|yf=IMOEX.ME
DAX|DAX 40 (Германия)|24000|yf=^GDAXI
FTSE|FTSE 100 (Великобритания)|9700|yf=^FTSE
N225|Nikkei 225 (Япония)|50000|yf=^N225
HSI|Hang Seng (Гонконг)|26000|yf=^HSI
SSEC|Shanghai Composite (Китай)|3900|yf=000001.SS
CAC|CAC 40 (Франция)|8100|yf=^FCHI`,

  crypto: `BTC|Биткоин|82500
ETH|Эфириум|2900
XRP|XRP|2.2
BNB|BNB|620
SOL|Solana|150
DOGE|Dogecoin|0.17
TRX|TRON|0.28
ADA|Cardano|0.6
HYPE|Hyperliquid|35
LINK|Chainlink|14
AVAX|Avalanche|21
XLM|Stellar|0.28
BCH|Bitcoin Cash|480
SUI|Sui|3
LTC|Litecoin|85
TON|Toncoin|2.8
HBAR|Hedera|0.19
SHIB|Shiba Inu|0.000013
DOT|Polkadot|3.8
UNI|Uniswap|6.5
XMR|Monero|320
AAVE|Aave|190
NEAR|NEAR Protocol|3.2
ETC|Ethereum Classic|17
APT|Aptos|4.5
ICP|Internet Computer|4.8
ONDO|Ondo|0.8
PEPE|Pepe|0.0000095
ARB|Arbitrum|0.4
FIL|Filecoin|2.3
ATOM|Cosmos|4.2
VET|VeChain|0.022
OP|Optimism|0.7
INJ|Injective|11
ALGO|Algorand|0.19
RENDER|Render|3.8
TAO|Bittensor|280
ENA|Ethena|0.45
SEI|Sei|0.28
POL|Polygon|0.22
JUP|Jupiter|0.45
TIA|Celestia|1.8
STX|Stacks|0.75
LDO|Lido DAO|0.9
CRV|Curve|0.65
FET|Fetch.ai|0.6
WLD|Worldcoin|1.1
BONK|Bonk|0.000018
PYTH|Pyth Network|0.11
PENDLE|Pendle|3.2`,

  ru: `SBER|Сбербанк|305
GAZP|Газпром|135
LKOH|Лукойл|7000
YDEX|Яндекс|4800
ROSN|Роснефть|440
NVTK|Новатэк|1050
GMKN|Норникель|120
TATN|Татнефть|620
SNGS|Сургутнефтегаз|22
MGNT|Магнит|4200
MTSS|МТС|215
MOEX|Мосбиржа|195
VTBR|ВТБ|78
ALRS|Алроса|48
CHMF|Северсталь|1080
NLMK|НЛМК|118
MAGN|ММК|36
PLZL|Полюс|1750
X5|X5 Group|2900
OZON|Озон|4300
TBANK|Т-Технологии|3100|moex=T
AFLT|Аэрофлот|54
PHOR|ФосАгро|6500
RUAL|Русал|35
IRAO|Интер РАО|3.4
HYDR|РусГидро|0.55
FEES|Россети ФСК ЕЭС|0.11
RTKM|Ростелеком|70
SBERP|Сбербанк (прив.)|300
SNGSP|Сургутнефтегаз (прив.)|21
TATNP|Татнефть (прив.)|600
TRNFP|Транснефть (прив.)|1300
POSI|Positive Technologies|1100
HEAD|Хэдхантер|3000
ASTR|Астра|300
SMLT|Самолёт|2200
PIKK|ПИК|550
FLOT|Совкомфлот|75
FIXP|Fix Price|220
WUSH|Whoosh|120
CBOM|МКБ|6.5
BSPB|Банк Санкт-Петербург|330
MTLR|Мечел|95
RASP|Распадская|240
UPRO|Юнипро|2
MSNG|Мосэнерго|3
AKRN|Акрон|17000
LSRG|ЛСР|600
ENPG|ЭН+ Групп|330
RENI|Ренессанс Страхование|80`,

  world: `AAPL|Apple|230
MSFT|Microsoft|500
NVDA|Nvidia|180
AMZN|Amazon|225
GOOGL|Alphabet (A)|190
META|Meta Platforms|700
AVGO|Broadcom|330
TSLA|Tesla|330
BRK-B|Berkshire Hathaway|480
LLY|Eli Lilly|800
WMT|Walmart|100
JPM|JPMorgan Chase|300
V|Visa|340
ORCL|Oracle|220
MA|Mastercard|560
XOM|Exxon Mobil|115
NFLX|Netflix|1200
COST|Costco|950
JNJ|Johnson & Johnson|170
HD|Home Depot|380
PLTR|Palantir|170
PG|Procter & Gamble|155
BAC|Bank of America|52
ABBV|AbbVie|190
CVX|Chevron|155
KO|Coca-Cola|70
TMUS|T-Mobile US|230
UNH|UnitedHealth|330
GE|GE Aerospace|280
AMD|AMD|165
CSCO|Cisco|70
WFC|Wells Fargo|80
IBM|IBM|250
CRM|Salesforce|260
MS|Morgan Stanley|140
ABT|Abbott|130
LIN|Linde|450
MCD|McDonald's|300
AXP|American Express|330
PM|Philip Morris|130
DIS|Walt Disney|110
ISRG|Intuitive Surgical|480
NOW|ServiceNow|900
GS|Goldman Sachs|700
T|AT&T|28
CAT|Caterpillar|450
INTU|Intuit|650
UBER|Uber|90
RTX|RTX|160
VZ|Verizon|42
TSM|TSMC (ADR)|280
ASML|ASML (ADR)|950
SAP|SAP (ADR)|250
TM|Toyota (ADR)|190
NVO|Novo Nordisk (ADR)|55
AZN|AstraZeneca (ADR)|80
SHEL|Shell (ADR)|70
HSBC|HSBC (ADR)|70
NVS|Novartis (ADR)|120
SHOP|Shopify|150
BABA|Alibaba (ADR)|130
TCEHY|Tencent (ADR)|65
SONY|Sony (ADR)|25
TTE|TotalEnergies (ADR)|60
BHP|BHP Group (ADR)|50
RY|Royal Bank of Canada|140
TD|Toronto-Dominion|80
UL|Unilever (ADR)|60
SNY|Sanofi (ADR)|50
HDB|HDFC Bank (ADR)|70
INFY|Infosys (ADR)|18
MELI|MercadoLibre|2300
PDD|PDD Holdings|130
BIDU|Baidu (ADR)|100
SE|Sea Limited|150
SPOT|Spotify|650
ARM|Arm Holdings|150
SMFG|Sumitomo Mitsui (ADR)|17
MUFG|Mitsubishi UFJ (ADR)|15
BP|BP (ADR)|33
DEO|Diageo (ADR)|100
BTI|British American Tobacco (ADR)|50
LVMUY|LVMH (ADR)|120
NSRGY|Nestlé (ADR)|95
RHHBY|Roche (ADR)|40
SIEGY|Siemens (ADR)|130
ALIZY|Allianz (ADR)|40
BNPQY|BNP Paribas (ADR)|38
NTES|NetEase (ADR)|110
JD|JD.com (ADR)|35
BYDDY|BYD (ADR)|60
RIO|Rio Tinto (ADR)|65
GSK|GSK (ADR)|40
TRP|TC Energy|50
ENB|Enbridge|45
CNQ|Canadian Natural Resources|30
ABBNY|ABB (ADR)|60
IBN|ICICI Bank (ADR)|30
DTEGY|Deutsche Telekom (ADR)|38
SBGSY|Schneider Electric (ADR)|45`
};
