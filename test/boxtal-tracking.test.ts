import { describe, it, expect } from "vitest";
import { extractTrackingNumber } from "../src/lib/server/boxtal";

describe("extractTrackingNumber", () => {
  it("lit carrier_reference de premier niveau", () => {
    expect(extractTrackingNumber({ carrier_reference: "CR123" })).toBe("CR123");
  });
  it("lit un numéro dans parcels/parcel (Mondial Relay)", () => {
    expect(extractTrackingNumber({ parcels: { parcel: [{ tracking: 75537808 }] } })).toBe("75537808");
  });
  it("joint plusieurs colis et ignore la référence Boxtal", () => {
    expect(extractTrackingNumber({ reference: "ABCDEFGHIJ0123456789", parcels: { parcel: [{ carrier_reference: "A1" }, { carrier_reference: "B2" }] } })).toBe("A1, B2");
  });
  it("renvoie null sans numéro", () => {
    expect(extractTrackingNumber({ state: "x" })).toBeNull();
    expect(extractTrackingNumber(undefined)).toBeNull();
  });
});
