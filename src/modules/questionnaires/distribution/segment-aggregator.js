import { resolveScaleFieldNames } from './field-parser.js';
import {
  buildCriterionSegmentDimension,
  buildQuestionSegmentDimensions,
  buildRespondentSegmentDimensions,
  buildScoreBandSegmentDimension,
} from './segment/index.js';

export function buildSegmentSummary(fields = [], responseRows = [], criteriaSummary = []) {
  const dimensions = [];
  const scaleNames = resolveScaleFieldNames(fields);

  const questionDimensions = buildQuestionSegmentDimensions(fields, responseRows, scaleNames);
  dimensions.push(...questionDimensions);

  const respondentDimensions = buildRespondentSegmentDimensions(responseRows, scaleNames);
  dimensions.push(...respondentDimensions);

  const criterionDimension = buildCriterionSegmentDimension(criteriaSummary);
  if (criterionDimension) dimensions.push(criterionDimension);

  const scoreBandDimension = buildScoreBandSegmentDimension(fields, responseRows);
  if (scoreBandDimension) dimensions.push(scoreBandDimension);

  return {
    totalDimensions: dimensions.length,
    dimensions,
  };
}
