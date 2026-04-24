// Pleine page : arbre catégories + liste (remplace l'ancien modal « Visualiser le stock »)
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { getMateriel, getConsommables, getCategories, categoryPathById } from '../db/database';
import { Materiel, Consommable, Categorie } from '../types';
import { TabScreenSafeArea } from '../components/UI';

const BROWSE_ALL = '__all__';

function openConsommableFromStockNav(navigation: any, id: string) {
  const parents: { navigate: (n: string, p?: object) => void }[] = [];
  const p1 = navigation.getParent?.();
  const p2 = p1?.getParent?.();
  if (p1) parents.push(p1);
  if (p2) parents.push(p2);

  for (const navObj of [navigation, ...parents]) {
    for (const routeName of ['Consom.', 'WsConso']) {
      try {
        navObj.navigate(routeName, { openConsoId: id });
        return;
      } catch {
        /* try next */
      }
    }
  }
  Alert.alert(
    'Consommable',
    "Navigation directe indisponible. Ouvrez l'écran Consommables pour modifier cet article."
  );
}

export default function StockBrowseScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'android' ? Math.max(insets.bottom, 52) : Math.max(insets.bottom, 12);

  const [materiels, setMateriels] = useState<Materiel[]>([]);
  const [consommables, setConsommables] = useState<Consommable[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [browseSource, setBrowseSource] = useState<'all' | 'materiel' | 'consommable'>('all');
  const [browseTopCategoryId, setBrowseTopCategoryId] = useState(BROWSE_ALL);
  const [browseLeafCategoryId, setBrowseLeafCategoryId] = useState(BROWSE_ALL);
  const [expandedTopCategoryIds, setExpandedTopCategoryIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [mats, consos, cats] = await Promise.all([getMateriel(), getConsommables(), getCategories()]);
    setMateriels(mats);
    setConsommables(consos);
    setCategories(cats);
    setHasLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const categoriesById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const topCategories = useMemo(
    () => categories.filter(c => !c.parent_id).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    [categories]
  );
  const categoryPathCache = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, categoryPathById(categories, c.id));
    }
    return map;
  }, [categories]);

  const categoryHasAncestor = useCallback(
    (categoryId: string | null | undefined, ancestorId: string) => {
      if (!categoryId) return false;
      let cur: Categorie | undefined = categoriesById.get(categoryId);
      let guard = 0;
      while (cur && guard++ < 64) {
        if (cur.id === ancestorId) return true;
        cur = cur.parent_id ? categoriesById.get(cur.parent_id) : undefined;
      }
      return false;
    },
    [categoriesById]
  );

  const isWithinTopCategory = useCallback(
    (categoryId?: string | null) => {
      if (!categoryId || browseTopCategoryId === BROWSE_ALL) return true;
      return categoryHasAncestor(categoryId, browseTopCategoryId);
    },
    [BROWSE_ALL, browseTopCategoryId, categoryHasAncestor]
  );

  const isWithinLeafCategory = useCallback(
    (categoryId?: string | null) => {
      if (!categoryId || browseLeafCategoryId === BROWSE_ALL) return true;
      return categoryHasAncestor(categoryId, browseLeafCategoryId);
    },
    [BROWSE_ALL, browseLeafCategoryId, categoryHasAncestor]
  );

  const browseItems = useMemo(() => {
    const out: { id: string; kind: 'materiel' | 'consommable'; nom: string; subtitle: string }[] = [];
    if (browseSource !== 'consommable') {
      for (const m of materiels) {
        if (!isWithinTopCategory(m.categorie_id) || !isWithinLeafCategory(m.categorie_id)) continue;
        out.push({
          id: m.id,
          kind: 'materiel',
          nom: m.nom,
          subtitle: [m.categorie_nom, (m as any).localisation_nom, m.statut].filter(Boolean).join(' · '),
        });
      }
    }
    if (browseSource !== 'materiel') {
      for (const c of consommables) {
        if (!isWithinTopCategory(c.categorie_id) || !isWithinLeafCategory(c.categorie_id)) continue;
        out.push({
          id: c.id,
          kind: 'consommable',
          nom: c.nom,
          subtitle: [c.categorie_nom, c.localisation_nom, `${c.stock_actuel} ${c.unite}`]
            .filter(Boolean)
            .join(' · '),
        });
      }
    }
    return out.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [browseSource, consommables, isWithinLeafCategory, isWithinTopCategory, materiels]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let total = 0;
    const addAncestors = (categoryId?: string | null) => {
      if (!categoryId) return;
      let cur: Categorie | undefined = categoriesById.get(categoryId);
      let guard = 0;
      while (cur && guard++ < 64) {
        counts.set(cur.id, (counts.get(cur.id) ?? 0) + 1);
        cur = cur.parent_id ? categoriesById.get(cur.parent_id) : undefined;
      }
    };
    if (browseSource !== 'consommable') {
      for (const m of materiels) {
        total += 1;
        addAncestors(m.categorie_id);
      }
    }
    if (browseSource !== 'materiel') {
      for (const c of consommables) {
        total += 1;
        addAncestors(c.categorie_id);
      }
    }
    return { counts, total };
  }, [browseSource, categoriesById, consommables, materiels]);

  const subcategoriesByTop = useMemo(() => {
    const out = new Map<string, Categorie[]>();
    for (const top of topCategories) {
      const descendants = categories
        .filter(c => c.id !== top.id && categoryHasAncestor(c.id, top.id))
        .sort((a, b) =>
          (categoryPathCache.get(a.id) ?? a.nom).localeCompare(categoryPathCache.get(b.id) ?? b.nom, 'fr')
        );
      out.set(top.id, descendants);
    }
    return out;
  }, [categories, topCategories, categoryHasAncestor, categoryPathCache]);

  const countItemsForCategory = useCallback(
    (ancestorCategoryId?: string) =>
      ancestorCategoryId ? categoryCounts.counts.get(ancestorCategoryId) ?? 0 : categoryCounts.total,
    [categoryCounts]
  );

  const listHeader = useMemo(
    () => (
      <View style={s.headerBlock}>
        <Text style={s.browseTreeTitle}>Type d'articles</Text>
        <View style={s.browseSegmentRow}>
          {[
            { id: 'all', label: 'Tout' },
            { id: 'materiel', label: 'Stock' },
            { id: 'consommable', label: 'Consom.' },
          ].map(opt => {
            const active = browseSource === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[s.browseSegmentBtn, active && s.browseSegmentBtnActive]}
                onPress={() => setBrowseSource(opt.id as 'all' | 'materiel' | 'consommable')}
              >
                <Text style={[s.browseSegmentBtnText, active && s.browseSegmentBtnTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={s.browseTreeTitle}>Navigation catégories / sous-catégories</Text>
        <TouchableOpacity
          style={[s.browseTreeRow, browseTopCategoryId === BROWSE_ALL && s.browseTreeRowActive]}
          onPress={() => {
            setBrowseTopCategoryId(BROWSE_ALL);
            setBrowseLeafCategoryId(BROWSE_ALL);
          }}
        >
          <Text style={[s.browseTreeRowText, browseTopCategoryId === BROWSE_ALL && s.browseTreeRowTextActive]}>
            Toutes les catégories
          </Text>
          <Text style={s.browseTreeCount}>{countItemsForCategory()}</Text>
        </TouchableOpacity>
        {topCategories.map(top => {
          const expanded = expandedTopCategoryIds.includes(top.id);
          const activeTop = browseTopCategoryId === top.id;
          const descendants = subcategoriesByTop.get(top.id) ?? [];
          return (
            <View key={top.id}>
              <View style={[s.browseTreeRow, activeTop && s.browseTreeRowActive]}>
                <TouchableOpacity
                  onPress={() =>
                    setExpandedTopCategoryIds(prev =>
                      prev.includes(top.id) ? prev.filter(x => x !== top.id) : [...prev, top.id]
                    )
                  }
                  style={s.browseTreeArrowHit}
                >
                  <Text style={s.browseTreeArrow}>{expanded ? '▾' : '▸'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.browseTreeMainHit}
                  onPress={() => {
                    setBrowseTopCategoryId(top.id);
                    setBrowseLeafCategoryId(BROWSE_ALL);
                  }}
                >
                  <Text style={[s.browseTreeRowText, activeTop && s.browseTreeRowTextActive]}>{top.nom}</Text>
                </TouchableOpacity>
                <Text style={s.browseTreeCount}>{countItemsForCategory(top.id)}</Text>
              </View>
              {expanded &&
                descendants.map(sub => {
                  const activeLeaf = browseLeafCategoryId === sub.id && browseTopCategoryId === top.id;
                  const path = categoryPathCache.get(sub.id) ?? sub.nom;
                  const depth = Math.max(1, path.split('›').length - 1);
                  return (
                    <TouchableOpacity
                      key={sub.id}
                      style={[
                        s.browseSubTreeRow,
                        { paddingLeft: 14 + depth * 12 },
                        activeLeaf && s.browseTreeRowActive,
                      ]}
                      onPress={() => {
                        setBrowseTopCategoryId(top.id);
                        setBrowseLeafCategoryId(sub.id);
                      }}
                    >
                      <Text style={[s.browseSubTreeRowText, activeLeaf && s.browseTreeRowTextActive]}>
                        {sub.nom}
                      </Text>
                      <Text style={s.browseTreeCount}>{countItemsForCategory(sub.id)}</Text>
                    </TouchableOpacity>
                  );
                })}
            </View>
          );
        })}
        <Text style={s.browseCountText}>{browseItems.length} article(s)</Text>
        {browseItems.length === 0 && (
          <View style={s.browseEmpty}>
            <Text style={s.browseEmptyText}>Aucun article dans ce filtre.</Text>
          </View>
        )}
      </View>
    ),
    [
      BROWSE_ALL,
      browseItems.length,
      browseLeafCategoryId,
      browseSource,
      browseTopCategoryId,
      categoryPathCache,
      countItemsForCategory,
      expandedTopCategoryIds,
      subcategoriesByTop,
      topCategories,
    ]
  );

  if (!hasLoaded) {
    return (
      <TabScreenSafeArea style={s.container}>
        <View style={s.initialLoad}>
          <ActivityIndicator color={Colors.green} size="large" />
          <Text style={s.initialLoadText}>Chargement…</Text>
        </View>
      </TabScreenSafeArea>
    );
  }

  return (
    <TabScreenSafeArea style={s.container} edges={['left', 'right']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={s.screenTitle} numberOfLines={1}>
          Visualiser le stock
        </Text>
        <View style={{ width: 72 }} />
      </View>
      <FlatList
        data={browseItems}
        keyExtractor={it => `${it.kind}-${it.id}`}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 + bottomPad, flexGrow: 1 }}
        renderItem={({ item: it }) => (
          <TouchableOpacity
            style={s.browseRow}
            onPress={() => {
              if (it.kind === 'materiel') {
                navigation.navigate('MaterielDetail', { materielId: it.id });
              } else {
                openConsommableFromStockNav(navigation, it.id);
              }
            }}
            activeOpacity={0.85}
          >
            <Text style={s.browseRowTitle}>
              {it.kind === 'materiel' ? '📦' : '🧪'} {it.nom}
            </Text>
            {!!it.subtitle && <Text style={s.browseRowSub}>{it.subtitle}</Text>}
          </TouchableOpacity>
        )}
      />
    </TabScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  initialLoad: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  initialLoadText: {
    color: Colors.textSecondary,
    marginTop: 16,
    fontSize: 15,
    fontWeight: '500',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backText: { color: Colors.green, fontSize: 16, fontWeight: '600' },
  screenTitle: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
  },
  headerBlock: { paddingTop: 8 },
  browseCountText: {
    color: Colors.textSecondary,
    marginBottom: 10,
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
  },
  browseTreeTitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  browseSegmentRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  browseSegmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
  },
  browseSegmentBtnActive: {
    borderColor: Colors.green,
    backgroundColor: Colors.greenBg,
  },
  browseSegmentBtnText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  browseSegmentBtnTextActive: { color: Colors.green },
  browseTreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  browseSubTreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgInput,
    paddingVertical: 8,
    paddingRight: 10,
    marginBottom: 6,
  },
  browseTreeRowActive: {
    borderColor: Colors.green,
    backgroundColor: Colors.greenBg,
  },
  browseTreeArrowHit: { width: 26, alignItems: 'center' },
  browseTreeArrow: { color: Colors.textMuted, fontSize: 16, fontWeight: '700' },
  browseTreeMainHit: { flex: 1 },
  browseTreeRowText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700', flex: 1 },
  browseSubTreeRowText: { color: Colors.textPrimary, fontSize: 12, fontWeight: '600', flex: 1 },
  browseTreeRowTextActive: { color: Colors.green },
  browseTreeCount: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', marginLeft: 8 },
  browseRow: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  browseRowTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  browseRowSub: { color: Colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 16 },
  browseEmpty: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  browseEmptyText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
});
