# Sri Lanka statutory parameters — verification record

Verified 2026-07-05 against public sources (re-verify each assessment year;
rates live in `statutory_rates`/`tax_tables` — a change is a data update).

| Item | Value | Basis |
|---|---|---|
| EPF employee | **8%** of total earnings | EPF Act No. 15 of 1958; Dept. of Labour / epf.lk confirm current |
| EPF employer | **12%** of total earnings | as above |
| ETF employer | **3%** of total earnings | ETF Act No. 46 of 1980 |
| APIT personal relief | **LKR 1,800,000/yr (150,000/mo)** | Y/A 2025/26 (effective 2025-04-01; raised from 1.2M) |
| APIT brackets (annual, above relief) | 6% first 1,000,000 · 18% next 500,000 · 24% next 500,000 · 30% next 500,000 · 36% balance | IRD APIT tables 2025/26 (12% band eliminated) |
| APIT monthly bracket boundaries | 150,000 / 233,333.33 / 275,000 / 316,666.67 / 358,333.33 | annual ÷ 12 |
| Gratuity | **½ month's last salary × completed years**, after **5 years** service; employers with **15+ employees** | Payment of Gratuity Act No. 12 of 1983 |
| EPF/ETF payment deadline | end of last working day of following month | Dept. of Labour |
| EPF/ETF base | total earnings: salary/wages, COLA, holiday pay, food allowance & similar | epf.lk employer FAQ |

Sources: [IRD tax chart 2025/26](https://www.ird.gov.lk/en/publications/SitePages/tax_chart_2526.aspx?menuid=1404),
[KPMG APIT tables Y/A 2025/26](https://assets.kpmg.com/content/dam/kpmg/lk/pdf/kpmg-tax-news/2025/march-2025/Tax-Flash-News-APIT-Tables.pdf),
[Dept. of Labour EPF division](https://labourdept.gov.lk/epf-division-new/),
[EPF employer FAQ](https://epf.lk/?page_id=811).

⚠ Payslip-affecting values must never be hardcoded — the payroll engine reads
the tenant's `statutory_rates` and `tax_tables` rows effective for the period.
