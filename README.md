# Gparc Mobile

Application web progressive (PWA) pour consulter sur téléphone une copie de la base SQLite de [Gparc](https://github.com/redatest/Gparc).

L’application est **en lecture seule** : elle ne modifie pas la base de données de Gparc.

## Utilisation

1. Depuis le PC Gparc, créer un instantané de la base SQLite avec l’outil d’export ci-dessous.
2. Transférer le fichier obtenu sur le téléphone, par USB ou par copie manuelle.
3. Ouvrir Gparc Mobile et importer le fichier `.db`.
4. Consulter les équipements, les pannes et interventions, les réformes, les structures, les utilisateurs, les références et les historiques.
5. Pour actualiser les données, exporter puis importer une nouvelle copie.

## Préparer la base à importer

Le dépôt contient `tools/export_sqlite_snapshot.py`, un utilitaire Python qui crée une copie cohérente de la base et vérifie son intégrité.

Dans un terminal, exécuter :

```powershell
python tools/export_sqlite_snapshot.py "C:\\chemin\\vers\\data\\gparc.db" "C:\\Users\\Public\\gparc-mobile.db"
```

Remplacer le premier chemin par celui de la base utilisée par Gparc. Si le fichier de destination existe déjà, ajouter `--force` pour le remplacer.

**Important :** ne pas copier directement le fichier `.db` pendant que Gparc fonctionne en mode WAL. Certaines écritures peuvent encore se trouver dans les fichiers associés. Utiliser l’utilitaire d’export pour obtenir un instantané cohérent.

## Fonctionnement et limites

- Les données sont stockées localement dans le navigateur et ne sont pas synchronisées automatiquement avec Gparc.
- L’application ne transmet pas la base SQLite à un serveur.
- Pour actualiser les informations, il faut importer une nouvelle copie.
- L’installation PWA et le service worker nécessitent un hébergement HTTPS (ou `localhost` pour les tests).
