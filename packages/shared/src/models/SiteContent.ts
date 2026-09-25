import mongoose, { Schema, model, type Model } from "mongoose";

export const SITE_CONTENT_PAGES = [
  "menu",
  "home",
  "pricing",
  "product",
  "colleague-pulse",
  "solutions",
  "how-it-works",
  "company",
  "contact",
  "privacy",
  "terms",
  "login",
] as const;
export type SiteContentPage = (typeof SITE_CONTENT_PAGES)[number];

export interface INavItem {
  key: string;
  label: string;
  visible: boolean;
  order: number;
}

export interface ISiteSection {
  key: string;
  label: string;
  visible: boolean;
}

export interface ISiteContent {
  page: SiteContentPage;
  navItems: INavItem[]; // page: "menu" only
  sections: ISiteSection[]; // page: "menu" only
  fields: Map<string, string>; // page-specific text fields
  createdAt: Date;
  updatedAt: Date;
}

const NavItemSchema = new Schema<INavItem>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    visible: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const SiteSectionSchema = new Schema<ISiteSection>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    visible: { type: Boolean, default: true },
  },
  { _id: false }
);

const SiteContentSchema = new Schema<ISiteContent>(
  {
    page: { type: String, enum: SITE_CONTENT_PAGES, required: true, unique: true },
    navItems: { type: [NavItemSchema], default: [] },
    sections: { type: [SiteSectionSchema], default: [] },
    fields: { type: Map, of: String, default: () => new Map() },
  },
  { timestamps: true }
);

export const SiteContent: Model<ISiteContent> =
  mongoose.models.SiteContent ?? model<ISiteContent>("SiteContent", SiteContentSchema);
