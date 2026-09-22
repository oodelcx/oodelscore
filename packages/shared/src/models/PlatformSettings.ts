import mongoose, { Schema, model, type Model } from "mongoose";

/** Singleton, admin-editable. Only one document should ever exist. */
export const PLATFORM_SETTINGS_SINGLETON_KEY = "default";

export interface IPlatformSettings {
  singletonKey: string;
  toursEnabled: boolean;
  // Global kill switch for the payment gate (Business/Group layouts).
  // Defaults FALSE deliberately: every account created before Stripe
  // billing existed has no BillingSubscription row at all, so flipping
  // this on the moment it merges would lock out real, already-paying
  // customers with nothing to show for it. Turn on only after confirming
  // existing accounts are either genuinely subscribed or marked comp.
  paymentGateEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformSettingsSchema = new Schema<IPlatformSettings>(
  {
    singletonKey: { type: String, required: true, unique: true, default: PLATFORM_SETTINGS_SINGLETON_KEY },
    toursEnabled: { type: Boolean, required: true, default: true },
    paymentGateEnabled: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

export const PlatformSettings: Model<IPlatformSettings> =
  mongoose.models.PlatformSettings ?? model<IPlatformSettings>("PlatformSettings", PlatformSettingsSchema);
