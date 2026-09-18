import mongoose, { Schema, model, type Model } from "mongoose";

/** Singleton, admin-editable. Only one document should ever exist. */
export const PLATFORM_SETTINGS_SINGLETON_KEY = "default";

export interface IPlatformSettings {
  singletonKey: string;
  toursEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformSettingsSchema = new Schema<IPlatformSettings>(
  {
    singletonKey: { type: String, required: true, unique: true, default: PLATFORM_SETTINGS_SINGLETON_KEY },
    toursEnabled: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

export const PlatformSettings: Model<IPlatformSettings> =
  mongoose.models.PlatformSettings ?? model<IPlatformSettings>("PlatformSettings", PlatformSettingsSchema);
