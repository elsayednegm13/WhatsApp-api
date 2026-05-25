import { handleApiRequest } from "../../server/app.js";
import { normalizeApiRequest, setNoStoreHeaders } from "../_normalize.js";

export default async function handler(req, res) {
  setNoStoreHeaders(res);
  normalizeApiRequest(req);
  await handleApiRequest(req, res);
}
