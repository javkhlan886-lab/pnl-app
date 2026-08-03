import api from "./axios";

export const getAssets = (params?: { category?: string; status?: string }) =>
  api.get("/assets", { params }).then(r => r.data);
export const createAsset = (data: any) => api.post("/assets", data).then(r => r.data);
export const updateAsset = (id: string, data: any) => api.put(`/assets/${id}`, data).then(r => r.data);
export const disposeAsset = (id: string) => api.delete(`/assets/${id}`).then(r => r.data);

export const calcDepreciation = (price: number, residual: number, lifespan: number, method: string, purchaseDate: string) => {
  const depBase = Math.max(0, price - residual);
  const monthsElapsed = Math.max(0, (Date.now() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  let monthly = 0, yearly = 0, accumulated = 0;
  if (method === "straight") {
    yearly = depBase / lifespan;
    monthly = yearly / 12;
    accumulated = Math.min(depBase, monthly * monthsElapsed);
  } else {
    const rate = 2 / lifespan;
    yearly = price * rate;
    monthly = yearly / 12;
    accumulated = Math.min(depBase, price * (1 - Math.pow(1 - rate / 12, monthsElapsed)));
  }
  return {
    monthly: Math.round(monthly),
    yearly: Math.round(yearly),
    accumulated: Math.round(accumulated),
    currentValue: Math.max(residual, price - Math.round(accumulated)),
    depreciatedPct: price > 0 ? Math.round((accumulated / price) * 100) : 0,
  };
};
