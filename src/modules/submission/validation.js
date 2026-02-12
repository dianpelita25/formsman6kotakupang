import { z } from 'zod';

const scaleValue = z.coerce.number().int().min(1).max(5);

export const submissionSchema = z.object({
  namaGuru: z.string().trim().min(1, 'Nama Guru wajib diisi'),
  lamaMengajar: z.enum(['< 5 Tahun', '5-10 tahun', '> 10 Tahun']),
  mataPelajaran: z.string().trim().min(1, 'Mata Pelajaran wajib diisi'),
  q1: scaleValue,
  q2: scaleValue,
  q3: scaleValue,
  q4: scaleValue,
  q5: scaleValue,
  q6: scaleValue,
  q7: scaleValue,
  q8: scaleValue,
  q9: scaleValue,
  q10: z.enum(['Sangat Berminat', 'Berminat', 'Cukup Berminat', 'Kurang Berminat', 'Tidak Berminat']),
  q11: scaleValue,
  q12: scaleValue,
});

export function validateSubmission(payload) {
  const result = submissionSchema.safeParse(payload);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.flatten(),
    };
  }

  return {
    ok: true,
    data: result.data,
  };
}
