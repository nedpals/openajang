# Experimental example extensions

These `openajang:*-unstable` shapes are documented only for the included examples. They are
not core requirements and are not a program, eligibility, or admission-selection
API. Consumers may ignore them. Broad implementation requires a separate reviewed
extension contract and schema, such as an [extension profile](EXTENSIONS.md); no
generic validator may require that support.

| Key | Illustrative shape | Core fallback |
| --- | --- | --- |
| `openajang:components-unstable` | Array of objects with `name`, `starts_at`, and location-shaped `location`. Dates retain original precision. | Overall description and registration/venue instructions identify which days have which attendance modes. No ticket coverage inferred. |
| `openajang:eligibility-unstable` | Object with integer `minimum_age`, `maximum_age`. | Belgrade registration instructions state ages 18–26. |
| `openajang:participation-unstable` | Object with integer `minimum_team_size`, `maximum_team_size`, boolean `individual_matching_available`, text `prerequisite`. | Registration instructions state team sizes, matching, and prior conference attendance. |
| `openajang:event-languages-unstable` | Object with arrays `working` and `presentations` of language tags. Worked as a [graduation candidate](extensions/openajang-event-languages-unstable/PROFILE.md). | Belgrade description names Serbian and English. Document `language` remains English. |
| `openajang:broadcast-unstable` | Object with URL `recordings_url` and boolean `counts_as_attendance`. | FOSDEM description says recordings remain available; core location remains physical. |

No extension may change the meaning of the core. Stripping every extension must
leave an accurate useful listing, though automation loses detail. Weekly visiting
hours are described in museum instructions. Structured opening-hours expansion is
outside the core contract.
