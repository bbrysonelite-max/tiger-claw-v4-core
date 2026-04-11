import { FlavorConfig } from "../types.js";
import { NETWORK_MARKETER_FLAVOR } from "./network-marketer.js";
import { ADMIN_FLAVOR } from "./admin.js";

// Tiger Claw is a single-flavor product: network-marketer.
// `admin` stays because it's infrastructure, not a customer flavor.
// Everything else lives in api/_archive/flavors/ — do not re-import from there.
export const FLAVOR_REGISTRY: Record<string, FlavorConfig> = {
  "network-marketer": NETWORK_MARKETER_FLAVOR,
  "admin": ADMIN_FLAVOR,
};

export default FLAVOR_REGISTRY;
