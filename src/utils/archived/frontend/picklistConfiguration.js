// Season-specific adapters belong at the app boundary, not in persistence or transport.
import { configurePicklist } from '../backend/data/picklistApi.js'
import { TBA_DISTRICT_KEY } from '../../../constants/scoring.js'

configurePicklist({ districtKey: TBA_DISTRICT_KEY })
