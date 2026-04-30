export const PT_PAYMENT_TERMS_SLUG = "payment_terms";
export const PT_SHIPPING_METHODS_SLUG = "shipping_methods";

export type PtMasterSlug = typeof PT_PAYMENT_TERMS_SLUG | typeof PT_SHIPPING_METHODS_SLUG;

export const PT_MASTER_SLUG_LABELS: Record<string, string> = {
  [PT_PAYMENT_TERMS_SLUG]: "支付條款",
  [PT_SHIPPING_METHODS_SLUG]: "運輸方式",
};
