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

## Exporter une copie cohérente depuis le PC Gparc

Le dépôt fournit `tools/export_sqlite_snapshot.py`, un utilitaire Python sans dépendances externes qui utilise l’API de sauvegarde SQLite et vérifie l’intégrité du fichier produit.

Depuis le dossier du dépôt téléchargé, exécuter dans un terminal :

```powershell
python tools/export_sqlite_snapshot.py "C:\\chemin\\vers\\data\\gparc.db" "C:\\Users\\Public\\gparc-mobile.db"
```

Remplacer le premier chemin par le chemin réel de la base utilisée par Gparc. Le chemin configuré dans `flask_app/database.py` est `data/gparc.db`, avec repli dans `flask_app/data/` si nécessaire. Si le fichier de destination existe déjà, ajouter `--force` à la commande pour le remplacer. Transférer ensuite `gparc-mobile.db` au téléphone par USB ou copie manuelle et l’importer dans la PWA.

Ne pas copier uniquement le fichier `.db` en cours d’utilisation si Gparc tourne en mode WAL : des écritures validées peuvent encore se trouver dans le fichier WAL. L’utilitaire crée un instantané cohérent et contrôle son intégrité avant de signaler le succès.
