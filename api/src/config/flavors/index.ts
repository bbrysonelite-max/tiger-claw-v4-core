import { FlavorConfig } from "../types.js";
import { NETWORK_MARKETER_FLAVOR } from "./network-marketer.js";
import { REAL_ESTATE_FLAVOR } from "./real-estate.js";
import { HEALTH_WELLNESS_FLAVOR } from "./health-wellness.js";
import { ADMIN_FLAVOR } from "./admin.js";
import { AIRBNB_HOST_FLAVOR } from "./airbnb-host.js";
import { LAWYER_FLAVOR } from "./lawyer.js";
import { PLUMBER_FLAVOR } from "./plumber.js";
import { SALES_TIGER_FLAVOR } from "./sales-tiger.js";
import { RESEARCHER_FLAVOR } from "./researcher.js";
import { MORTGAGE_BROKER_FLAVOR } from "./mortgage-broker.js";

export const FLAVOR_REGISTRY: Record<string, FlavorConfig> = {
  "network-marketer": NETWORK_MARKETER_FLAVOR,
  "real-estate": REAL_ESTATE_FLAVOR,
  "health-wellness": HEALTH_WELLNESS_FLAVOR,
  "admin": ADMIN_FLAVOR,
  "airbnb-host": AIRBNB_HOST_FLAVOR,
  "lawyer": LAWYER_FLAVOR,
  "plumber": PLUMBER_FLAVOR,
  "sales-tiger": SALES_TIGER_FLAVOR,
  "researcher": RESEARCHER_FLAVOR,
  "mortgage-broker": MORTGAGE_BROKER_FLAVOR,
};

export default FLAVOR_REGISTRY;
