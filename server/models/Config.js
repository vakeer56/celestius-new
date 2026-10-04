import mongoose from "mongoose";

const ConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "recruitment_config",
    },
    recruitmentOpenStatus: {
      type: Boolean,
      required: true,
      default: true,
    },
    registrationCloseDate: {
      type: Date,
      default: () => new Date("2026-10-15T23:59:59+05:30"),
    },
    closedRoles: {
      type: [String],
      default: () => ["Backend Developer"],
    },
  },
  { timestamps: true }
);

export default mongoose.models.Config || mongoose.model("Config", ConfigSchema);
