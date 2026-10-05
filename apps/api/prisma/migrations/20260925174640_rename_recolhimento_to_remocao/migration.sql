ALTER TYPE "StatusOrdemRecolhimento" RENAME TO "StatusOrdemRemocao";
ALTER TABLE "ordens_recolhimento" RENAME TO "ordens_remocao";
ALTER TABLE "ordens_remocao" RENAME CONSTRAINT "ordens_recolhimento_pkey" TO "ordens_remocao_pkey";
ALTER TABLE "ordens_remocao" RENAME CONSTRAINT "ordens_recolhimento_criado_por_id_fkey" TO "ordens_remocao_criado_por_id_fkey";
ALTER TABLE "ordens_remocao" RENAME CONSTRAINT "ordens_recolhimento_tecnico_id_fkey" TO "ordens_remocao_tecnico_id_fkey";
