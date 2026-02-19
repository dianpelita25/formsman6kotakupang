import {
  getAnalyticsCsv,
  getAnalyticsDistribution,
  getAnalyticsSummary,
  getAnalyticsTrend,
  submitForm,
} from './service.js';

function mapServerError(error, fallbackMessage) {
  const rawMessage = error?.message ?? '';

  if (rawMessage.includes('DATABASE_URL belum diset')) {
    return {
      status: 503,
      message: 'Database belum dikonfigurasi. Isi DATABASE_URL di file .env lalu restart server.',
      code: 'DB_CONFIG_MISSING',
    };
  }

  if (
    rawMessage.includes('ECONN') ||
    rawMessage.includes('ENOTFOUND') ||
    rawMessage.includes('fetch failed')
  ) {
    return {
      status: 503,
      message: 'Koneksi ke database gagal. Cek internet, kredensial, dan host database.',
      code: 'DB_CONNECTION_ERROR',
    };
  }

  return {
    status: 500,
    message: fallbackMessage,
    code: 'INTERNAL_SERVER_ERROR',
  };
}

export async function submitFormController(req, res) {
  try {
    const result = await submitForm(req.body);

    if (!result.ok) {
      return res.status(result.status).json({
        message: result.message,
        errors: result.errors,
      });
    }

    return res.status(result.status).json({
      message: 'Terima kasih, feedback berhasil dikirim.',
      data: result.data,
    });
  } catch (error) {
    const mapped = mapServerError(error, 'Terjadi kesalahan pada server saat menyimpan feedback.');
    return res.status(mapped.status).json({ message: mapped.message, code: mapped.code });
  }
}

export async function getAnalyticsSummaryController(_req, res) {
  try {
    const data = await getAnalyticsSummary();
    return res.json({ data });
  } catch (error) {
    const mapped = mapServerError(error, 'Gagal mengambil ringkasan analytics.');
    return res.status(mapped.status).json({ message: mapped.message, code: mapped.code });
  }
}

export async function getAnalyticsDistributionController(_req, res) {
  try {
    const data = await getAnalyticsDistribution();
    return res.json({ data });
  } catch (error) {
    const mapped = mapServerError(error, 'Gagal mengambil distribusi analytics.');
    return res.status(mapped.status).json({ message: mapped.message, code: mapped.code });
  }
}

export async function getAnalyticsTrendController(req, res) {
  try {
    const { days } = req.query;
    const data = await getAnalyticsTrend(days);
    return res.json({ data });
  } catch (error) {
    const mapped = mapServerError(error, 'Gagal mengambil trend analytics.');
    return res.status(mapped.status).json({ message: mapped.message, code: mapped.code });
  }
}

export async function exportAnalyticsCsvController(_req, res) {
  try {
    const csvContent = await getAnalyticsCsv();
    const filename = `feedback-analytics-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.status(200).send(csvContent);
  } catch (error) {
    const mapped = mapServerError(error, 'Gagal mengekspor data CSV.');
    return res.status(mapped.status).json({ message: mapped.message, code: mapped.code });
  }
}
