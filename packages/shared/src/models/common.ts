import { Schema } from "mongoose";

export interface IAddress {
  street: string;
  city: string;
  postcode: string;
}

export const AddressSchema = new Schema<IAddress>(
  {
    street: { type: String, default: "" },
    city: { type: String, default: "" },
    postcode: { type: String, default: "" },
  },
  { _id: false }
);
