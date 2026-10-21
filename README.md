# Gparc Mobile

PWA mobile en **lecture seule**, conçue pour consulter une copie manuellement importée de la base SQLite de [Gparc](https://github.com/redatest/Gparc).

## Fonctionnement

1. Depuis le PC qui héberge Gparc, créer une copie cohérente de la base SQLite active.
2. Transférer le fichier de sauvegarde sur le téléphone par USB ou copie manuelle.
3. Ouvrir Gparc Mobile, choisir le fichier `.db`, puis attendre la validation.
4. Consulter le parc, les pannes/interventions, les réformes, les structures, les utilisateurs, les références, les paramètres, les historiques et le schéma SQLite.
5. Pour actualiser les données, exporter une nouvelle copie depuis Gparc et l’importer à nouveau dans l’application.

## Audit du dépôt source

- Le chemin de base configuré dans `flask_app/database.py` est `data/gparc.db`, avec repli dans `flask_app/data/` si nécessaire.
- La connexion SQLite utilise WAL et `foreign_keys = ON`; les migrations de compatibilité sont exécutées par `database_migrations.py`.
- Le schéma de référence est défini dans `flask_app/database_schema.py`, puis complété par les migrations.
- Tables principales : `materiel`, `panne`, `affect_mat`, `historique_reforme`, `structures`, `utilisateurs`, `type_mat`, `model_mat`, `lieu_rep`, `parametres_materiel`, `parametre_type_mat`, `oracle_sync_history`.
- Les routes de lecture principales sont `GET /api/materiels`, `GET /api/pannes`, `GET /api/stats`, `GET /api/structures`, `GET /api/parametres` et `GET /api/references`.
- Les états des pannes sont codés `EP` (en panne), `ER` (en réparation), `RP` (réparé), `IR` (irréparable). L’état physique du matériel et son statut de réforme sont des notions distinctes.

## Sécurité et limites

- L’application ne comporte aucune action d’écriture dans les données métier de Gparc.
- La base importée est stockée localement dans le navigateur (IndexedDB) pour éviter de la réimporter à chaque ouverture sur le même navigateur/appareil.
- Les données affichées correspondent à la date d’export ; elles ne se synchronisent pas automatiquement.
- L’application ne transmet pas le fichier SQLite à un serveur. Le moteur SQL.js est chargé depuis jsDelivr lors du premier chargement ; l’accès hors ligne au moteur dépend de la réussite de sa mise en cache.
- Héberger la PWA via HTTPS (ou localhost pour les tests) pour activer l’installation et le service worker.

## Copie SQLite recommandée

Ne pas copier uniquement le fichier `.db` en cours d’utilisation si Gparc tourne en mode WAL : des écritures validées peuvent encore se trouver dans le fichier WAL. Utiliser l’API de sauvegarde SQLite ou une copie produite par un mécanisme équivalent, puis transférer le fichier de sauvegarde final.
