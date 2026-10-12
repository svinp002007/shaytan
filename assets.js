// Каталог активов для раздела «Перпы». Цены в списках — примерные стартовые значения для демо-симуляции.
// Когда подключён живой источник (бейдж Live), цена заменяется настоящей. Состав и порядок приблизительные.
// Формат строки: ТИКЕР|Название|цена[|s]   (s — бумага входит в S&P 500)
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

  world: `AAPL|Apple|230|s
MSFT|Microsoft|500|s
NVDA|Nvidia|180|s
AMZN|Amazon|225|s
GOOGL|Alphabet (A)|190|s
META|Meta Platforms|700|s
AVGO|Broadcom|330|s
TSLA|Tesla|330|s
BRK-B|Berkshire Hathaway|480|s
LLY|Eli Lilly|800|s
WMT|Walmart|100|s
JPM|JPMorgan Chase|300|s
V|Visa|340|s
ORCL|Oracle|220|s
MA|Mastercard|560|s
XOM|Exxon Mobil|115|s
NFLX|Netflix|1200|s
COST|Costco|950|s
JNJ|Johnson & Johnson|170|s
HD|Home Depot|380|s
PLTR|Palantir|170|s
PG|Procter & Gamble|155|s
BAC|Bank of America|52|s
ABBV|AbbVie|190|s
CVX|Chevron|155|s
KO|Coca-Cola|70|s
TMUS|T-Mobile US|230|s
UNH|UnitedHealth|330|s
GE|GE Aerospace|280|s
AMD|AMD|165|s
CSCO|Cisco|70|s
WFC|Wells Fargo|80|s
IBM|IBM|250|s
CRM|Salesforce|260|s
MS|Morgan Stanley|140|s
ABT|Abbott|130|s
LIN|Linde|450|s
MCD|McDonald's|300|s
AXP|American Express|330|s
PM|Philip Morris|130|s
DIS|Walt Disney|110|s
ISRG|Intuitive Surgical|480|s
NOW|ServiceNow|900|s
GS|Goldman Sachs|700|s
T|AT&T|28|s
CAT|Caterpillar|450|s
INTU|Intuit|650|s
UBER|Uber|90|s
RTX|RTX|160|s
VZ|Verizon|42|s
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
SBGSY|Schneider Electric (ADR)|45`,

  sp: `ADBE|Adobe|350
ACN|Accenture|250
QCOM|Qualcomm|160
TXN|Texas Instruments|180
AMAT|Applied Materials|180
MU|Micron|120
LRCX|Lam Research|100
KLAC|KLA|900
ADI|Analog Devices|230
INTC|Intel|24
ANET|Arista Networks|110
PANW|Palo Alto Networks|190
CRWD|CrowdStrike|480
SNPS|Synopsys|480
CDNS|Cadence|320
MSI|Motorola Solutions|400
APH|Amphenol|110
TEL|TE Connectivity|200
FTNT|Fortinet|100
WDAY|Workday|230
ADSK|Autodesk|300
ROP|Roper Technologies|480
NXPI|NXP|220
MCHP|Microchip|60
ON|ON Semiconductor|50
GLW|Corning|50
DELL|Dell|120
HPQ|HP Inc|28
HPE|Hewlett Packard Enterprise|22
NTAP|NetApp|110
STX.US|Seagate|140|yf=STX
WDC|Western Digital|90
KEYS|Keysight|170
FICO|Fair Isaac|1700
IT|Gartner|400
CTSH|Cognizant|70
EPAM|EPAM Systems|160
GDDY|GoDaddy|150
FFIV|F5|300
TYL|Tyler Technologies|550
PTC|PTC|180
TRMB|Trimble|75
ZBRA|Zebra|300
TER|Teradyne|110
SMCI|Super Micro|40
GEN|Gen Digital|28
AKAM|Akamai|80
VRSN|VeriSign|270
CDW|CDW|170
TDY|Teledyne|480
FSLR|First Solar|200
ENPH|Enphase|40
MPWR|Monolithic Power|800
SWKS|Skyworks|70
QRVO|Qorvo|85
JBL|Jabil|200
DDOG|Datadog|140
APP|AppLovin|450
DASH|DoorDash|220
ABNB|Airbnb|130
COIN|Coinbase|300
HOOD|Robinhood|90
AXON|Axon Enterprise|700
CPRT|Copart|45
PAYC|Paycom|220
EBAY|eBay|85
GOOG|Alphabet (C)|190
CMCSA|Comcast|35
CHTR|Charter|300
EA|Electronic Arts|150
TTWO|Take-Two|230
OMC|Omnicom|80
LYV|Live Nation|140
WBD|Warner Bros. Discovery|18
PSKY|Paramount Skydance|15
FOXA|Fox (A)|55
FOX|Fox (B)|50
NWSA|News Corp (A)|28
NWS|News Corp (B)|30
MTCH|Match Group|35
NKE|Nike|70
LOW|Lowe's|250
SBUX|Starbucks|90
TJX|TJX|125
BKNG|Booking Holdings|5000
ORLY|O'Reilly Automotive|95
AZO|AutoZone|3700
MAR|Marriott|270
HLT|Hilton|250
CMG|Chipotle|45
ROST|Ross Stores|150
YUM|Yum! Brands|145
DHI|D.R. Horton|140
LEN|Lennar|120
NVR|NVR|7500
PHM|PulteGroup|110
GM|General Motors|55
F|Ford|11
EXPE|Expedia|190
RCL|Royal Caribbean|300
CCL|Carnival|27
NCLH|Norwegian Cruise Line|20
LVS|Las Vegas Sands|50
WYNN|Wynn Resorts|100
MGM|MGM Resorts|35
ULTA|Ulta Beauty|480
DRI|Darden|190
DPZ|Domino's|420
TSCO|Tractor Supply|55
BBY|Best Buy|75
KMX|CarMax|65
POOL|Pool Corp|300
GPC|Genuine Parts|125
LKQ|LKQ|38
APTV|Aptiv|65
BWA|BorgWarner|40
TPR|Tapestry|100
RL|Ralph Lauren|280
LULU|Lululemon|200
DECK|Deckers|105
HAS|Hasbro|70
CZR|Caesars|30
GRMN|Garmin|200
PEP|PepsiCo|140
MDLZ|Mondelez|60
MO|Altria|60
CL|Colgate-Palmolive|80
KMB|Kimberly-Clark|120
GIS|General Mills|55
KHC|Kraft Heinz|27
HSY|Hershey|180
STZ|Constellation Brands|140
KDP|Keurig Dr Pepper|33
SYY|Sysco|75
KR|Kroger|70
ADM|Archer-Daniels-Midland|55
TGT|Target|100
DG|Dollar General|105
DLTR|Dollar Tree|100
EL|Estée Lauder|80
CHD|Church & Dwight|90
CLX|Clorox|120
MNST|Monster Beverage|65
CAG|Conagra|25
SJM|J.M. Smucker|105
HRL|Hormel|28
MKC|McCormick|75
TSN|Tyson Foods|50
BG|Bunge|90
KVUE|Kenvue|17
CPB|Campbell's|33
LW|Lamb Weston|50
BF-B|Brown-Forman|30
TAP|Molson Coors|50
MRK|Merck|85
PFE|Pfizer|25
TMO|Thermo Fisher|520
DHR|Danaher|230
AMGN|Amgen|290
GILD|Gilead|110
BMY|Bristol-Myers Squibb|48
VRTX|Vertex|430
REGN|Regeneron|600
MDT|Medtronic|95
SYK|Stryker|380
BSX|Boston Scientific|100
ELV|Elevance Health|340
CI|Cigna|280
HCA|HCA Healthcare|400
CVS|CVS Health|65
MCK|McKesson|800
COR|Cencora|300
ZTS|Zoetis|150
BDX|Becton Dickinson|190
EW|Edwards Lifesciences|80
IDXX|IDEXX|600
A|Agilent|130
IQV|IQVIA|190
RMD|ResMed|270
GEHC|GE HealthCare|78
MRNA|Moderna|28
BIIB|Biogen|150
DXCM|Dexcom|70
MTD|Mettler-Toledo|1300
WAT|Waters|380
STE|Steris|240
ZBH|Zimmer Biomet|100
LH|Labcorp|260
DGX|Quest Diagnostics|180
CAH|Cardinal Health|150
PODD|Insulet|320
ALGN|Align Technology|140
BAX|Baxter|22
COO|Cooper Companies|70
UHS|Universal Health Services|190
HUM|Humana|270
CNC|Centene|35
MOH|Molina Healthcare|150
TECH|Bio-Techne|55
WST|West Pharmaceutical|300
RVTY|Revvity|100
CRL|Charles River|160
INCY|Incyte|80
VTRS|Viatris|10
HSIC|Henry Schein|70
DVA|DaVita|130
SOLV|Solventum|70
C|Citigroup|95
SCHW|Charles Schwab|95
BLK|BlackRock|1100
SPGI|S&P Global|500
PGR|Progressive|250
CB|Chubb|280
MMC|Marsh McLennan|200
AON|Aon|360
ICE|Intercontinental Exchange|170
CME|CME Group|270
MCO|Moody's|480
USB|U.S. Bancorp|48
PNC|PNC Financial|195
TFC|Truist|43
COF|Capital One|220
BK|BNY|105
STT|State Street|105
AIG|AIG|80
MET|MetLife|80
PRU|Prudential Financial|105
ALL|Allstate|200
TRV|Travelers|260
AFL|Aflac|105
HIG|Hartford|125
CINF|Cincinnati Financial|150
WRB|W. R. Berkley|70
NDAQ|Nasdaq Inc|90
CBOE|Cboe Global Markets|240
MSCI|MSCI|560
FDS|FactSet|400
TROW|T. Rowe Price|105
BEN|Franklin Resources|22
IVZ|Invesco|20
NTRS|Northern Trust|125
RJF|Raymond James|160
AMP|Ameriprise|500
FITB|Fifth Third|42
HBAN|Huntington Bancshares|16
KEY|KeyCorp|18
RF|Regions Financial|25
CFG|Citizens Financial|47
MTB|M&T Bank|190
SYF|Synchrony|70
PYPL|PayPal|70
FISV|Fiserv|70
FIS|Fidelity National Information|75
GPN|Global Payments|80
JKHY|Jack Henry|170
BRO|Brown & Brown|100
AJG|Arthur J. Gallagher|300
L|Loews|100
GL|Globe Life|130
EG|Everest Group|350
ERIE|Erie Indemnity|400
PFG|Principal Financial|80
ACGL|Arch Capital|95
AIZ|Assurant|210
MKTX|MarketAxess|200
CPAY|Corpay|330
KKR|KKR|140
BX|Blackstone|160
APO|Apollo Global|140
IBKR|Interactive Brokers|60
HON|Honeywell|210
UNP|Union Pacific|230
BA|Boeing|190
DE|Deere|480
LMT|Lockheed Martin|480
UPS|UPS|100
ETN|Eaton|340
ITW|Illinois Tool Works|260
EMR|Emerson|135
PH|Parker-Hannifin|700
NOC|Northrop Grumman|540
GD|General Dynamics|320
MMM|3M|150
WM|Waste Management|220
CSX|CSX|35
NSC|Norfolk Southern|280
FDX|FedEx|240
JCI|Johnson Controls|105
TT|Trane Technologies|430
CARR|Carrier|60
OTIS|Otis|95
PCAR|Paccar|100
CMI|Cummins|360
ROK|Rockwell Automation|360
AME|Ametek|190
FAST|Fastenal|45
GWW|W.W. Grainger|1000
URI|United Rentals|900
VRSK|Verisk|280
CTAS|Cintas|200
PWR|Quanta Services|380
DAL|Delta Air Lines|60
UAL|United Airlines|95
LUV|Southwest Airlines|33
AAL|American Airlines|12
ODFL|Old Dominion|150
JBHT|J.B. Hunt|150
EXPD|Expeditors|120
CHRW|C.H. Robinson|110
LHX|L3Harris|260
TDG|TransDigm|1300
HWM|Howmet|190
TXT|Textron|75
XYL|Xylem|130
IR|Ingersoll Rand|85
DOV|Dover|175
PNR|Pentair|100
SWK|Stanley Black & Decker|80
SNA|Snap-on|340
GNRC|Generac|150
FTV|Fortive|55
HUBB|Hubbell|420
AOS|A. O. Smith|75
ALLE|Allegion|160
MAS|Masco|70
BLDR|Builders FirstSource|130
LII|Lennox|530
J|Jacobs|140
NDSN|Nordson|220
IEX|IDEX|190
PAYX|Paychex|130
ADP|ADP|280
EFX|Equifax|250
BR|Broadridge|230
ROL|Rollins|55
RSG|Republic Services|245
VLTO|Veralto|100
WAB|Wabtec|190
LDOS|Leidos|190
GEV|GE Vernova|600
VRT|Vertiv|150
COP|ConocoPhillips|95
EOG|EOG Resources|115
SLB|SLB|38
OXY|Occidental|45
MPC|Marathon Petroleum|180
PSX|Phillips 66|130
VLO|Valero|150
WMB|Williams|60
KMI|Kinder Morgan|27
OKE|ONEOK|80
BKR|Baker Hughes|48
HAL|Halliburton|25
DVN|Devon Energy|33
FANG|Diamondback|145
CTRA|Coterra|25
EQT|EQT|55
TRGP|Targa Resources|190
APA|APA|22
EXE|Expand Energy|100
NEE|NextEra Energy|75
SO|Southern Company|90
DUK|Duke Energy|120
AEP|American Electric Power|115
D|Dominion Energy|56
SRE|Sempra|80
EXC|Exelon|45
XEL|Xcel Energy|75
PEG|PSEG|80
ED|Consolidated Edison|100
WEC|WEC Energy|110
EIX|Edison International|55
ETR|Entergy|95
DTE|DTE Energy|135
ES|Eversource|65
FE|FirstEnergy|45
PPL|PPL|36
AEE|Ameren|100
CMS|CMS Energy|72
CEG|Constellation Energy|330
VST|Vistra|190
NRG|NRG Energy|160
AWK|American Water Works|140
CNP|CenterPoint|37
ATO|Atmos Energy|150
NI|NiSource|42
LNT|Alliant Energy|65
EVRG|Evergy|70
PNW|Pinnacle West|90
SHW|Sherwin-Williams|340
ECL|Ecolab|260
APD|Air Products|280
FCX|Freeport-McMoRan|40
NEM|Newmont|85
NUE|Nucor|135
DOW|Dow|22
DD|DuPont|80
LYB|LyondellBasell|55
PPG|PPG Industries|105
CTVA|Corteva|65
VMC|Vulcan Materials|270
MLM|Martin Marietta|600
STLD|Steel Dynamics|135
IP|International Paper|50
PKG|Packaging Corp|220
BALL|Ball|50
AMCR|Amcor|9
AVY|Avery Dennison|180
CF|CF Industries|85
MOS|Mosaic|25
ALB|Albemarle|80
IFF|IFF|75
EMN|Eastman Chemical|75
SW|Smurfit Westrock|45
PLD|Prologis|115
AMT|American Tower|200
EQIX|Equinix|800
WELL|Welltower|160
SPG|Simon Property|175
PSA|Public Storage|290
O|Realty Income|57
DLR|Digital Realty|170
CCI|Crown Castle|105
VICI|VICI Properties|32
EXR|Extra Space Storage|140
AVB|AvalonBay|200
EQR|Equity Residential|62
IRM|Iron Mountain|100
SBAC|SBA Communications|200
WY|Weyerhaeuser|27
ARE|Alexandria Real Estate|70
CBRE|CBRE|150
CSGP|CoStar|80
INVH|Invitation Homes|28
MAA|Mid-America Apartment|140
ESS|Essex Property|270
UDR|UDR|40
KIM|Kimco|22
HST|Host Hotels|16
REG|Regency Centers|70
FRT|Federal Realty|100
CPT|Camden Property|105
BXP|BXP|70
DOC|Healthpeak|20
VTR|Ventas|70
WSM|Williams-Sonoma|200
TTD|The Trade Desk|80
TKO|TKO Group|190
EME|EMCOR|600
WTW|Willis Towers Watson|330`
};
