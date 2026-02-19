import { resolveQuestionnaireContext } from './context.js';
import { resolveVersionFields } from './distribution.js';
import {
  normalizeFromFilter,
  normalizePage,
  normalizePageSize,
  normalizeSearch,
  normalizeToFilter,
} from './query-utils.js';
import { escapeCsvValue, formatAnswerForCsv, toResponseListItem } from './response-utils.js';
import {
  MAX_SEGMENT_DRILLDOWN_ROWS,
  filterResponsesBySegment,
  isSegmentDrilldownEligible,
  resolveSegmentFilter,
} from './segment-filter.js';
import { listQuestionnaireResponsesForAggregation, listQuestionnaireResponsesV2 } from './repository.js';

function matchesSearch(row, normalizedSearch = '') {
  const search = String(normalizedSearch || '').trim().toLowerCase();
  if (!search) return true;
  const payload = `${JSON.stringify(row?.respondent || {})} ${JSON.stringify(row?.answers || {})} ${JSON.stringify(row?.payload || {})}`.toLowerCase();
  return payload.includes(search);
}

function paginateRows(rows = [], page = 1, pageSize = 20) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Number(pageSize) || 20);
  const offset = (safePage - 1) * safePageSize;
  return {
    page: safePage,
    pageSize: safePageSize,
    total: rows.length,
    items: rows.slice(offset, offset + safePageSize),
  };
}

async function resolveContextWithFilters(env, tenantId, questionnaireSlug, query = {}) {
  const context = await resolveQuestionnaireContext(env, tenantId, questionnaireSlug, query.questionnaireVersionId);
  if (!context.ok) return context;

  const filters = {
    tenantId,
    questionnaireId: context.questionnaire.id,
    questionnaireVersionId: context.questionnaireVersionId,
    from: normalizeFromFilter(query.from),
    to: normalizeToFilter(query.to),
  };
  return {
    ok: true,
    context,
    filters,
  };
}

async function resolveSegmentFilteredRows(env, contextResult, query = {}, filters = {}) {
  const segmentFilter = resolveSegmentFilter(query);
  if (!segmentFilter.ok) return segmentFilter;

  if (segmentFilter.segmentFilterActive && !isSegmentDrilldownEligible(segmentFilter.segmentDimensionId)) {
    return {
      ok: false,
      status: 422,
      message: 'Dimensi segmentasi ini tidak mendukung drilldown responses.',
    };
  }

  if (!segmentFilter.segmentFilterActive) {
    return {
      ok: true,
      segmentFilter,
      rows: null,
    };
  }

  const fields = resolveVersionFields(contextResult.context.selectedVersion || {});
  const candidates = await listQuestionnaireResponsesForAggregation(env, filters, MAX_SEGMENT_DRILLDOWN_ROWS + 1);
  if (candidates.length > MAX_SEGMENT_DRILLDOWN_ROWS) {
    return {
      ok: false,
      status: 422,
      message: `Jumlah data terlalu besar untuk drilldown segment. Persempit filter (maksimal ${MAX_SEGMENT_DRILLDOWN_ROWS} respons).`,
    };
  }

  const { matched } = filterResponsesBySegment({
    fields,
    responseRows: candidates,
    segmentDimensionId: segmentFilter.segmentDimensionId,
    segmentBucket: segmentFilter.segmentBucket,
  });

  return {
    ok: true,
    segmentFilter,
    rows: matched,
  };
}

export async function getTenantQuestionnaireResponses(env, tenantId, questionnaireSlug, query = {}) {
  const contextResult = await resolveContextWithFilters(env, tenantId, questionnaireSlug, query);
  if (!contextResult.ok) return contextResult;

  const search = normalizeSearch(query.search);
  const page = normalizePage(query.page);
  const pageSize = normalizePageSize(query.pageSize);
  const segmentRows = await resolveSegmentFilteredRows(env, contextResult, query, contextResult.filters);
  if (!segmentRows.ok) return segmentRows;

  if (!segmentRows.segmentFilter.segmentFilterActive) {
    const result = await listQuestionnaireResponsesV2(env, {
      ...contextResult.filters,
      search,
      page,
      pageSize,
    });

    return {
      ok: true,
      status: 200,
      data: {
        questionnaire: contextResult.context.questionnaire,
        filters: {
          page: result.page,
          pageSize: result.pageSize,
          search,
          from: contextResult.filters.from,
          to: contextResult.filters.to,
          questionnaireVersionId: contextResult.context.questionnaireVersionId,
          segmentDimensionId: null,
          segmentBucket: null,
        },
        total: result.total,
        items: result.items.map(toResponseListItem),
      },
    };
  }

  const searchedRows = segmentRows.rows.filter((row) => matchesSearch(row, search));
  const paginated = paginateRows(searchedRows, page, pageSize);

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: contextResult.context.questionnaire,
      filters: {
        page: paginated.page,
        pageSize: paginated.pageSize,
        search,
        from: contextResult.filters.from,
        to: contextResult.filters.to,
        questionnaireVersionId: contextResult.context.questionnaireVersionId,
        segmentDimensionId: segmentRows.segmentFilter.segmentDimensionId,
        segmentBucket: segmentRows.segmentFilter.segmentBucket,
      },
      total: paginated.total,
      items: paginated.items.map(toResponseListItem),
    },
  };
}

export async function exportTenantQuestionnaireResponsesCsv(env, tenantId, questionnaireSlug, query = {}) {
  const contextResult = await resolveContextWithFilters(env, tenantId, questionnaireSlug, query);
  if (!contextResult.ok) return contextResult;

  const segmentRows = await resolveSegmentFilteredRows(env, contextResult, query, contextResult.filters);
  if (!segmentRows.ok) return segmentRows;

  const rows = segmentRows.segmentFilter.segmentFilterActive
    ? segmentRows.rows
    : await listQuestionnaireResponsesForAggregation(env, contextResult.filters, 20000);
  const fields = resolveVersionFields(contextResult.context.selectedVersion || {});

  const respondentKeys = new Set();
  const answerKeyOrder = [];
  const answerKeySet = new Set();

  fields.forEach((field) => {
    if (!field?.name) return;
    if (!answerKeySet.has(field.name)) {
      answerKeySet.add(field.name);
      answerKeyOrder.push(field.name);
    }
  });

  rows.forEach((row) => {
    Object.keys(row.respondent || {}).forEach((key) => respondentKeys.add(key));
    Object.keys(row.answers || {}).forEach((key) => {
      if (!answerKeySet.has(key)) {
        answerKeySet.add(key);
        answerKeyOrder.push(key);
      }
    });
  });

  const respondentColumns = Array.from(respondentKeys).sort();
  const headers = [
    'id',
    'submitted_at',
    'questionnaire_version_id',
    ...respondentColumns.map((key) => `respondent.${key}`),
    ...answerKeyOrder.map((key) => `answer.${key}`),
  ];

  const lines = [headers.map(escapeCsvValue).join(',')];
  rows.forEach((row) => {
    const values = [
      row.id,
      row.createdAt,
      row.questionnaireVersionId,
      ...respondentColumns.map((key) => row.respondent?.[key] ?? ''),
      ...answerKeyOrder.map((key) => formatAnswerForCsv(row.answers?.[key])),
    ];
    lines.push(values.map(escapeCsvValue).join(','));
  });

  return {
    ok: true,
    status: 200,
    data: {
      questionnaire: contextResult.context.questionnaire,
      questionnaireVersionId: contextResult.context.questionnaireVersionId,
      csv: lines.join('\n'),
    },
  };
}
