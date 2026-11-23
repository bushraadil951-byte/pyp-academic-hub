import mongoose from 'mongoose';

// One document (key 'settings'): how SA, DT and IBT are weighted, and where the bands start.
const appraisalSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  weights: { SA: Number, DT: Number, IBT: Number },     // Grades 3-5
  weights12: { SA: Number, DT: Number },                // Grades 1-2
  meeting: Number,       // this % and above = Meeting Expectation
  exceeding: Number,     // this % and above = Exceeding Expectation
});

export const AppraisalSettings = mongoose.model('AppraisalSettings', appraisalSettingsSchema);
