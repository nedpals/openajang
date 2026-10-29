# Experimental example extensions

These `unstable:*` shapes are documented only for the included examples. They are
not core requirements and are not a program, eligibility, or admission-selection
API. Consumers may ignore them. Broad implementation requires a separate reviewed
extension contract and schema; no generic validator may require that support.

| Key | Illustrative shape | Core fallback |
| --- | --- | --- |
| `unstable:components` | Array of objects with `name`, `starts_at`, and location-shaped `location`. Dates retain original precision. | Overall description and registration/venue instructions identify which days have which attendance modes. No ticket coverage inferred. |
| `unstable:eligibility` | Object with integer `minimum_age`, `maximum_age`. | Belgrade registration instructions state ages 18–26. |
| `unstable:participation` | Object with integer `minimum_team_size`, `maximum_team_size`, boolean `individual_matching_available`, text `prerequisite`. | Registration instructions state team sizes, matching, and prior conference attendance. |
| `unstable:event_languages` | Object with arrays `working` and `presentations` of language tags. | Belgrade description names Serbian and English. Document `language` remains English. |
| `unstable:broadcast` | Object with URL `recordings_url` and boolean `counts_as_attendance`. | FOSDEM description says recordings remain available; core location remains physical. |

No extension may change the meaning of the core. Stripping every extension must
leave an accurate useful listing, though automation loses detail. Weekly visiting
hours are described in museum instructions. Structured opening-hours expansion is
outside the core contract.
