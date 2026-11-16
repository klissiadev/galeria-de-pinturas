"""Script de Reprodução da Avaliação Experimental (FBC).

Executa o protocolo experimental offline e exibe a comparação contra baselines
conforme exigido pelo Guia do Trabalho (Seções 4, 5 e 7).

Uso:
    python evaluate.py
"""
import sys
from recommendations.evaluator import RecommenderEvaluator


def main():
    print("=" * 80)
    print(" SISTEMA DE RECOMENDAÇÃO: GALERIA DE PINTURAS (FBC)")
    print(" AVALIAÇÃO EXPERIMENTAL OFFLINE & MÉTRICAS CONTRA BASELINES")
    print("=" * 80)

    evaluator = RecommenderEvaluator(seed=42, min_ratings=5)
    results = evaluator.run_all(k_list=[5, 10])

    meta = results["metadata"]
    print(f"\n[+] Usuários avaliados: {meta['num_users_evaluated']}")
    print(f"[+] Total de pinturas no catálogo: {meta['num_total_paintings']}")
    print(f"[+] Divisão treino/teste: {int((1 - meta['test_ratio']) * 100)}% treino / {int(meta['test_ratio'] * 100)}% teste")
    print(f"[+] Limiar de relevância: nota >= {meta['relevance_threshold']}")
    print(f"[+] Semente aleatória (seed): {meta['seed']}\n")

    models = results["models"]
    
    # Tabela Top-5
    print("-" * 88)
    print(" TABELA COMPARATIVA DE RESULTADOS: TOP-5 (N = 5)")
    print("-" * 88)
    header = f"{'Modelo':<35} | {'P@5':<8} | {'R@5':<8} | {'nDCG@5':<8} | {'Cobert.':<8} | {'Divers.':<8} | {'Novidade':<8}"
    print(header)
    print("-" * 88)
    for _, m in models.items():
        metrics = m["metrics"]
        print(
            f"{m['label']:<35} | "
            f"{metrics['precision@5']:<8.4f} | "
            f"{metrics['recall@5']:<8.4f} | "
            f"{metrics['ndcg@5']:<8.4f} | "
            f"{metrics['coverage@5']:<8.4f} | "
            f"{metrics['diversity@5']:<8.4f} | "
            f"{metrics['novelty@5']:<8.2f}"
        )
    print("-" * 88)

    # Tabela Top-10
    print("\n" + "-" * 88)
    print(" TABELA COMPARATIVA DE RESULTADOS: TOP-10 (N = 10)")
    print("-" * 88)
    header10 = f"{'Modelo':<35} | {'P@10':<8} | {'R@10':<8} | {'nDCG@10':<8} | {'Cobert.':<8} | {'Divers.':<8} | {'Novidade':<8}"
    print(header10)
    print("-" * 88)
    for _, m in models.items():
        metrics = m["metrics"]
        print(
            f"{m['label']:<35} | "
            f"{metrics['precision@10']:<8.4f} | "
            f"{metrics['recall@10']:<8.4f} | "
            f"{metrics['ndcg@10']:<8.4f} | "
            f"{metrics['coverage@10']:<8.4f} | "
            f"{metrics['diversity@10']:<8.4f} | "
            f"{metrics['novelty@10']:<8.2f}"
        )
    print("-" * 88)

    # Casos Qualitativos
    print("\n" + "=" * 80)
    print(" AVALIAÇÃO QUALITATIVA (CASOS DE ESTUDO & ANÁLISE DE LIMITAÇÕES)")
    print("=" * 80)
    for i, c in enumerate(results.get("qualitative_cases", []), start=1):
        status_tag = "[ERRO/LIMITAÇÃO]" if c.get("is_error") else "[SUCESSO]"
        print(f"\n{i}. {status_tag} {c['title']} (Usuário ID: {c['user_id']})")
        print(f"   Contexto: {c['description']}")
        print(f"   Métricas no usuário: P@5 = {c['metrics']['precision_at_5']:.2f} | R@5 = {c['metrics']['recall_at_5']:.2f}")
        print("   Obras recomendadas no Top-5:")
        for r_idx, rec in enumerate(c["recommendations"][:5], start=1):
            p = rec.get("painting", {})
            title = p.get("title", "Obra")
            artist = p.get("artist", "Artista desconhecido")
            hit_str = "✓ RELEVANTE NO TESTE" if rec.get("is_hit") else ("✗ DESGOSTOU NO TESTE" if rec.get("test_rating", 0) in (1, 2) else "- Não avaliado no teste")
            print(f"     #{r_idx}: '{title}' ({artist}) -> {hit_str}")

    print("\n[✓] Avaliação concluída com sucesso. Resultados salvos em data/dataset/evaluation_results.json.\n")


if __name__ == "__main__":
    main()
