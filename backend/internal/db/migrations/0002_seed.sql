-- Seed: the 2026 roadmap the design mockup was drawn against.
-- Idempotent — every statement is INSERT OR IGNORE, so re-running the
-- migration against a populated database is a no-op.

INSERT OR IGNORE INTO roadmaps (id, name, year) VALUES ('rm-2026', 'Roadmap 2026', 2026);

INSERT OR IGNORE INTO teams (id, roadmap_id, name, capacity_etp, position) VALUES
    ('payment', 'rm-2026', 'Payment', 4, 0),
    ('checkout', 'rm-2026', 'Checkout', 3.5, 1),
    ('facturation', 'rm-2026', 'Facturation', 3, 2),
    ('abonnements', 'rm-2026', 'Abonnements', 3, 3),
    ('data', 'rm-2026', 'Data', 4, 4),
    ('infra', 'rm-2026', 'Infra & Observabilité', 4.5, 5),
    ('secu', 'rm-2026', 'Sécurité & Conformité', 3, 6),
    ('mobile', 'rm-2026', 'Mobile', 4, 7),
    ('web', 'rm-2026', 'Web', 3, 8),
    ('design', 'rm-2026', 'Design System', 2.5, 9),
    ('growth', 'rm-2026', 'Growth', 3, 10);

INSERT OR IGNORE INTO themes (id, roadmap_id, name, base_color, tint_color, ink_color, line_color, icon_path, position) VALUES
    ('t1', 'rm-2026', 'Encaisser plus, mieux', '#7C3AED', '#F5F3FF', '#5B21B6', '#DDD6FE', 'M1.6 4h10.8v6.4H1.6zM1.6 6.4h10.8M3.6 8.6h2.2', 0),
    ('t2', 'rm-2026', 'Socle technique', '#0D9488', '#F0FDFA', '#115E59', '#99F6E4', 'M2 2.4h10v3.4H2zM2 8.2h10v3.4H2zM4 4.1h1.6M4 9.9h1.6', 1),
    ('t3', 'rm-2026', 'Conformité', '#0E7490', '#ECFEFF', '#155E75', '#A5F3FC', 'M7 1.8l4.3 1.6v3.3c0 2.6-1.8 4.4-4.3 5.5-2.5-1.1-4.3-2.9-4.3-5.5V3.4zM5.2 6.9l1.4 1.4 2.4-2.6', 2),
    ('t4', 'rm-2026', 'Expérience client', '#DB2777', '#FDF2F8', '#9D174D', '#FBCFE8', 'M7 7.2a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM2.5 12c.6-1.9 2.3-3.1 4.5-3.1s3.9 1.2 4.5 3.1', 3),
    ('t5', 'rm-2026', 'Données & pilotage', '#CA8A04', '#FEFCE8', '#854D0E', '#FEF08A', 'M7 4.3c2.7 0 4.9-.8 4.9-1.7S9.7.9 7 .9 2.1 1.7 2.1 2.6 4.3 4.3 7 4.3zM2.1 2.6v8.8c0 1 2.2 1.7 4.9 1.7s4.9-.7 4.9-1.7V2.6M2.1 7c0 1 2.2 1.7 4.9 1.7s4.9-.7 4.9-1.7', 4),
    ('t6', 'rm-2026', 'Dette & qualité', '#65A30D', '#F7FEE7', '#3F6212', '#D9F99D', 'M7 1.9l5 2.5-5 2.5-5-2.5zM2 7.5l5 2.5 5-2.5M2 10.2l5 2.5 5-2.5', 5);

INSERT OR IGNORE INTO bricks (id, roadmap_id, team_id, theme_id, kind, title, etp, start_month, duration, link) VALUES
    ('b1', 'rm-2026', 'payment', 't1', 'work', 'Refonte du tunnel de paiement', 2.5, 0, 5, 'notion.so/tunnel-paiement'),
    ('b2', 'rm-2026', 'payment', 't3', 'work', 'PSD2 / SCA — authentification forte', 1.5, 0, 3, ''),
    ('b3', 'rm-2026', 'payment', 't1', 'work', 'Portefeuilles locaux', 1.5, 6, 4, ''),
    ('b4', 'rm-2026', 'payment', 't6', 'work', 'Dette technique paiement', 1, 5, 2, ''),
    ('b5', 'rm-2026', 'payment', 't1', 'work', 'Paiement en 3 fois', 2, 9, 3, ''),
    ('b6', 'rm-2026', 'checkout', 't4', 'work', 'A/B test panier express', 1, 1, 2, ''),
    ('b7', 'rm-2026', 'checkout', 't4', 'work', 'Livraison multi-transporteurs', 2, 3, 5, 'notion.so/livraison'),
    ('b8', 'rm-2026', 'checkout', 't1', 'work', 'Codes promo v2', 2, 6, 3, ''),
    ('b9', 'rm-2026', 'checkout', 't1', 'work', 'Wallet & paiement en un clic', 2, 9, 3, ''),
    ('b10', 'rm-2026', 'facturation', 't2', 'work', 'Migration base de données', 2, 0, 4, 'notion.so/migration-bdd'),
    ('b11', 'rm-2026', 'facturation', 't3', 'work', 'Facturation électronique 2026', 2.5, 6, 3, ''),
    ('b12', 'rm-2026', 'facturation', 't1', 'work', 'Refonte des avoirs', 1.5, 7, 2, ''),
    ('b13', 'rm-2026', 'facturation', 't3', 'work', 'Fact. électronique — déploiement', 1.5, 9, 3, ''),
    ('b14', 'rm-2026', 'abonnements', 't1', 'work', 'Paliers tarifaires', 1.5, 0, 2, ''),
    ('b15', 'rm-2026', 'abonnements', 't2', 'work', 'Migration Stripe Billing', 2.5, 3, 4, ''),
    ('b16', 'rm-2026', 'abonnements', 't5', 'work', 'Rétention & churn', 1.5, 7, 3, ''),
    ('b17', 'rm-2026', 'abonnements', 't1', 'work', 'Facturation à l’usage', 2, 9, 3, ''),
    ('b18', 'rm-2026', 'data', 't5', 'work', 'Migration entrepôt de données', 3, 0, 6, 'notion.so/entrepot'),
    ('b19', 'rm-2026', 'data', 't5', 'work', 'Observabilité des flux', 2, 6, 3, ''),
    ('b20', 'rm-2026', 'data', 't3', 'work', 'RGPD : purge & rétention', 1.5, 7, 2, ''),
    ('b21', 'rm-2026', 'data', 't5', 'work', 'Catalogue de données', 2, 9, 3, ''),
    ('b22', 'rm-2026', 'infra', 't2', 'work', 'Kubernetes 1.31', 2, 0, 3, ''),
    ('b23', 'rm-2026', 'infra', 't2', 'work', 'Traces distribuées', 2, 1, 5, ''),
    ('b24', 'rm-2026', 'infra', 't3', 'work', 'Plan de reprise d’activité', 2.5, 6, 3, ''),
    ('b25', 'rm-2026', 'infra', 't6', 'work', 'Dette technique CI/CD', 1.5, 6, 2, ''),
    ('b26', 'rm-2026', 'infra', 't2', 'work', 'Migration du maillage réseau', 1.5, 8, 2, ''),
    ('b27', 'rm-2026', 'infra', 't2', 'work', 'Réduction du coût cloud', 2.5, 9, 3, ''),
    ('b28', 'rm-2026', 'secu', 't3', 'work', 'Conformité RGPD', 2, 0, 5, 'notion.so/rgpd'),
    ('b29', 'rm-2026', 'secu', 't3', 'work', 'Audit ISO 27001', 2, 6, 4, ''),
    ('b30', 'rm-2026', 'secu', 't3', 'work', 'Gestion des secrets', 1.5, 6, 2, ''),
    ('b31', 'rm-2026', 'secu', 't3', 'work', 'SSO & SCIM', 2, 10, 2, ''),
    ('b32', 'rm-2026', 'mobile', 't4', 'work', 'App mobile v3 — refonte', 3, 0, 6, ''),
    ('b33', 'rm-2026', 'mobile', 't4', 'work', 'Notifications push v2', 2, 6, 3, ''),
    ('b34', 'rm-2026', 'mobile', 't4', 'work', 'Mode hors-ligne', 2.5, 9, 3, ''),
    ('b35', 'rm-2026', 'web', 't4', 'work', 'Refonte de la page d’accueil', 2, 3, 3, ''),
    ('b36', 'rm-2026', 'web', 't4', 'work', 'SEO technique', 1.5, 6, 3, ''),
    ('b37', 'rm-2026', 'web', 't4', 'work', 'Accessibilité RGAA', 2, 9, 3, ''),
    ('b38', 'rm-2026', 'design', 't6', 'work', 'Design system v2 — tokens', 2, 0, 5, 'notion.so/ds-v2'),
    ('b39', 'rm-2026', 'design', 't6', 'work', 'Composants data-viz', 1.5, 6, 3, ''),
    ('b40', 'rm-2026', 'design', 't6', 'work', 'Documentation & adoption', 1, 9, 3, ''),
    ('b41', 'rm-2026', 'growth', 't4', 'work', 'Parcours d’essai gratuit', 2, 3, 3, ''),
    ('b42', 'rm-2026', 'growth', 't5', 'work', 'Recommandations produit', 2, 6, 3, ''),
    ('b43', 'rm-2026', 'growth', 't4', 'work', 'Programme de parrainage', 1.5, 9, 3, ''),
    ('a1', 'rm-2026', 'payment', NULL, 'absence', 'Congés d’été', 1, 7, 1, ''),
    ('a2', 'rm-2026', 'checkout', NULL, 'absence', 'Congés d’été', 1, 7, 1, ''),
    ('a3', 'rm-2026', 'data', NULL, 'absence', 'Congés d’été', 0.5, 7, 1, ''),
    ('a4', 'rm-2026', 'infra', NULL, 'absence', 'Congés & astreinte', 0.5, 7, 1, ''),
    ('a5', 'rm-2026', 'design', NULL, 'absence', 'Congés d’été', 0.5, 7, 1, ''),
    ('a6', 'rm-2026', 'secu', NULL, 'absence', 'Congé parental', 1, 2, 4, '');

INSERT OR IGNORE INTO dependencies (id, roadmap_id, from_brick_id, to_brick_id) VALUES
    ('dep-1', 'rm-2026', 'b18', 'b11'),
    ('dep-2', 'rm-2026', 'b1', 'b7'),
    ('dep-3', 'rm-2026', 'b28', 'b20'),
    ('dep-4', 'rm-2026', 'b15', 'b5');
