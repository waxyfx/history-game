#pragma once
namespace tj {
constexpr int ItemCount=8;
enum ItemType { WeaponItem,AmmoItem,ConsumableItem,HistoricalItem,KeyItem,ArtifactItem };
struct ItemDef {const char* id;const char* name;const char* description;int type,limit;};
constexpr ItemDef items[]={
 {"sword","Қылыш","Жақын қашықтықтағы кең соққы. Уақыт саяхатшысының жабдығы.",WeaponItem,1},
 {"spear","Найза","Ұзын әрі тар бағытталған соққы.",WeaponItem,1},
 {"bow","Садақ","Жебені жұмсайтын қашықтық қаруы.",WeaponItem,1},
 {"arrows","Жебелер","Садаққа арналған оқ-дәрі. Әр шығарылған жебе жұмсалады.",AmmoItem,99},
 {"field-kit","Көмек қобдишасы","Саяхатшының қобдишасы: 35 денсаулық қалпына келтіреді.",ConsumableItem,9},
 {"stone-tool","Тас құрал","Зерттеу үшін жиналған тас құрал. Оқу тапсырмасына арналған зат.",HistoricalItem,1},
 {"time-key","Уақыт кілті","Болашақ оқиғаға арналған сюжеттік зат. Уақыт құрдымын тұрақтандырады.",KeyItem,1},
 {"chronicle-shard","Шежіре сынығы","Табылған көркем артефакт. Тарихи жад сынығы.",ArtifactItem,9}
};
struct Inventory {int counts[ItemCount]={1,1,1,12,0,0,0,0};unsigned picked=0;};
struct Pickup {int zone,item,quantity;float x,y;};
constexpr Pickup pickups[]={
 {0,5,2,136,184},
 {0,4,8,168,184},
 {1,6,1,264,216},
 {1,7,1,408,248},
 {1,8,1,312,280},
 {2,6,1,240,180},
 {3,4,12,320,180},
 {4,8,1,200,220}
};
constexpr int PickupCount=sizeof(pickups)/sizeof(pickups[0]);
}
