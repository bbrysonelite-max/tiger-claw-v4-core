import { FlavorConfig } from "../types.js";
import { NETWORK_MARKETER_FLAVOR } from "./network-marketer.js";
import { REAL_ESTATE_FLAVOR } from "./real-estate.js";
import { HEALTH_WELLNESS_FLAVOR } from "./health-wellness.js";
import { ADMIN_FLAVOR } from "./admin.js";
import { AIRBNB_HOST_FLAVOR } from "./airbnb-host.js";
import { BAKER_FLAVOR } from "./baker.js";
import { CANDLE_MAKER_FLAVOR } from "./candle-maker.js";
import { GIG_ECONOMY_FLAVOR } from "./gig-economy.js";
import { LAWYER_FLAVOR } from "./lawyer.js";
import { PLUMBER_FLAVOR } from "./plumber.js";
import { SALES_TIGER_FLAVOR } from "./sales-tiger.js";
import { RESEARCHER_FLAVOR } from "./researcher.js";
import { INTERIOR_DESIGNER_FLAVOR } from "./interior-designer.js";
import { DORM_DESIGN_FLAVOR } from "./dorm-design.js";
import { MORTGAGE_BROKER_FLAVOR } from "./mortgage-broker.js";
import { PERSONAL_TRAINER_FLAVOR } from "./personal-trainer.js";

export const FLAVOR_REGISTRY: Record<string, FlavorConfig> = {
  "network-marketer": NETWORK_MARKETER_FLAVOR,
  "real-estate": REAL_ESTATE_FLAVOR,
  "health-wellness": HEALTH_WELLNESS_FLAVOR,
  "admin": ADMIN_FLAVOR,
  "airbnb-host": AIRBNB_HOST_FLAVOR,
  "baker": BAKER_FLAVOR,
  "candle-maker": CANDLE_MAKER_FLAVOR,
  "gig-economy": GIG_ECONOMY_FLAVOR,
  "lawyer": LAWYER_FLAVOR,
  "plumber": PLUMBER_FLAVOR,
  "sales-tiger": SALES_TIGER_FLAVOR,
  "researcher": RESEARCHER_FLAVOR,
  "interior-designer": INTERIOR_DESIGNER_FLAVOR,
  "dorm-design": DORM_DESIGN_FLAVOR,
  "mortgage-broker": MORTGAGE_BROKER_FLAVOR,
  "personal-trainer": PERSONAL_TRAINER_FLAVOR,
};

export default FLAVOR_REGISTRY;
