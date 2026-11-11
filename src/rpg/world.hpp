#pragma once
#include "renderer.hpp"
namespace tj {
constexpr int ZoneCount = 6;
enum Terrain { Grass, Dirt, Water, Bridge, Cliff, CaveFloor };
enum Object { Empty, Tree, Rock, Shelter, Fire, Machine, Guide, Workbench, Hunter, Elder, Petroglyph, Rift };
struct Zone {
    unsigned char terrain[Rows][Cols]{};
    unsigned char objects[Rows][Cols]{};
};
inline bool solidObject(int type) { return type!=Empty && type!=Fire && type!=Petroglyph; }
inline void makeZone(Zone& z,int index) {
    for(int y=0;y<Rows;++y)for(int x=0;x<Cols;++x) {
        z.terrain[y][x]=index>=4?CaveFloor:Grass;
        z.objects[y][x]=Empty;
        if(y==0||y==Rows-1||x==0||x==Cols-1) z.terrain[y][x]=Cliff;
        else if(index<4&&(x*19+y*31+index*13)%41==0)z.objects[y][x]=Tree;
        else if(index>=4&&(x*23+y*17)%37==0)z.objects[y][x]=Rock;
    }

    if(index==0) {
        // Zone 0: Crash site
        for(int y=9;y<=11;++y)for(int x=1;x<Cols-1;++x) { z.terrain[y][x]=Dirt; z.objects[y][x]=Empty; }
        for(int y=9;y<=11;++y) z.terrain[y][Cols-1]=Dirt; // exit East
        for(int y=1;y<Rows-1;++y)for(int x=19;x<=21;++x) {
            z.terrain[y][x]=(y>=9&&y<=11)?Bridge:Water;
            z.objects[y][x]=Empty;
        }
        for(int y=6;y<=13;++y)for(int x=3;x<=11;++x) { z.terrain[y][x]=Dirt;z.objects[y][x]=Empty; }
        z.objects[7][6]=Machine;
        z.objects[6][13]=Rock;z.objects[14][15]=Rock;
        z.objects[5][4]=Tree;z.objects[14][3]=Tree;
        z.objects[5][24]=Tree;z.objects[14][25]=Tree;
    } else if(index==1) {
        // Zone 1: Ancient settlement
        for(int y=9;y<=11;++y)for(int x=0;x<Cols;++x) { z.terrain[y][x]=Dirt; z.objects[y][x]=Empty; }
        for(int y=5;y<=14;++y)for(int x=7;x<=23;++x) { z.terrain[y][x]=Dirt;z.objects[y][x]=Empty; }
        // Exits in 4 directions:
        for(int y=9;y<=11;++y) { z.terrain[y][0]=Dirt; z.terrain[y][Cols-1]=Dirt; } // West & East
        for(int x=14;x<=16;++x) { z.terrain[0][x]=Dirt; z.terrain[Rows-1][x]=Dirt; } // North & South
        for(int y=1;y<=4;++y)for(int x=14;x<=16;++x) { z.terrain[y][x]=Dirt; z.objects[y][x]=Empty; }
        for(int y=15;y<=Rows-2;++y)for(int x=14;x<=16;++x) { z.terrain[y][x]=Dirt; z.objects[y][x]=Empty; }
        z.objects[6][10]=Shelter;z.objects[6][20]=Shelter;
        z.objects[13][18]=Shelter;z.objects[8][15]=Fire;
        z.objects[10][13]=Guide;z.objects[12][9]=Workbench;
        z.objects[4][6]=Tree;z.objects[14][25]=Tree;
        z.objects[15][6]=Rock;
        // Combat clearing south
        for(int y=15;y<=17;++y)for(int x=10;x<=27;++x){z.terrain[y][x]=Dirt;z.objects[y][x]=Empty;}
    } else if(index==2) {
        // Zone 2: Ancient Workshop (North of settlement)
        for(int y=5;y<=15;++y)for(int x=6;x<=24;++x) { z.terrain[y][x]=Dirt; z.objects[y][x]=Empty; }
        // Exit South to Zone 1
        for(int x=14;x<=16;++x) { z.terrain[Rows-1][x]=Dirt; }
        for(int y=15;y<=Rows-2;++y)for(int x=14;x<=16;++x) { z.terrain[y][x]=Dirt; z.objects[y][x]=Empty; }
        z.objects[6][9]=Workbench; z.objects[6][18]=Workbench; z.objects[12][12]=Workbench;
        z.objects[9][15]=Guide; // Craftsman
        z.objects[7][13]=Fire;
        z.objects[8][8]=Rock; z.objects[13][8]=Rock; z.objects[8][21]=Rock; z.objects[14][20]=Rock;
        z.objects[4][5]=Tree; z.objects[4][24]=Tree;
    } else if(index==3) {
        // Zone 3: Forest and Hunting Ground (East of settlement)
        for(int y=8;y<=12;++y)for(int x=0;x<=18;++x) { z.terrain[y][x]=Dirt; z.objects[y][x]=Empty; }
        for(int y=12;y<=Rows-1;++y)for(int x=19;x<=22;++x) { z.terrain[y][x]=Dirt; z.objects[y][x]=Empty; }
        for(int y=9;y<=11;++y) z.terrain[y][0]=Dirt; // Exit West to Zone 1
        for(int x=19;x<=22;++x) z.terrain[Rows-1][x]=Dirt; // Exit South to Zone 4
        // Forest trees and clearings
        for(int y=3;y<=6;++y)for(int x=4;x<=10;++x) z.objects[y][x]=Tree;
        for(int y=3;y<=8;++y)for(int x=22;x<=27;++x) z.objects[y][x]=Tree;
        for(int y=14;y<=17;++y)for(int x=3;x<=12;++x) z.objects[y][x]=Tree;
        z.objects[9][14]=Hunter;
        z.objects[11][12]=Fire;
        z.objects[10][20]=Rock; z.objects[15][24]=Rock;
    } else if(index==4) {
        // Zone 4: Cave with Petroglyphs
        for(int y=1;y<Rows-1;++y)for(int x=1;x<Cols-1;++x) { z.terrain[y][x]=CaveFloor; z.objects[y][x]=Empty; }
        // Exits North to Zone 1 and North-East to Zone 3:
        for(int x=14;x<=16;++x) { z.terrain[0][x]=Dirt; for(int y=1;y<=3;++y) z.terrain[y][x]=Dirt; }
        for(int x=19;x<=22;++x) { z.terrain[0][x]=Dirt; for(int y=1;y<=3;++y) z.terrain[y][x]=Dirt; }
        // Secret crack North-West to Zone 5:
        for(int x=5;x<=7;++x) { z.terrain[0][x]=CaveFloor; for(int y=1;y<=3;++y) z.terrain[y][x]=CaveFloor; }
        // Cave features
        z.objects[2][10]=Petroglyph; z.objects[2][12]=Petroglyph;
        z.objects[2][17]=Petroglyph; z.objects[2][19]=Petroglyph;
        z.objects[9][15]=Elder;
        z.objects[11][15]=Fire; z.objects[6][8]=Fire; z.objects[6][22]=Fire;
        z.objects[14][7]=Rock; z.objects[14][22]=Rock; z.objects[8][4]=Rock; z.objects[8][26]=Rock;
    } else if(index==5) {
        // Zone 5: Secret Zone (Antagonist Anomaly Rift)
        for(int y=1;y<Rows-1;++y)for(int x=1;x<Cols-1;++x) { z.terrain[y][x]=CaveFloor; z.objects[y][x]=Empty; }
        // Exit South back to Zone 4:
        for(int x=5;x<=7;++x) { z.terrain[Rows-1][x]=CaveFloor; for(int y=Rows-4;y<Rows-1;++y) z.terrain[y][x]=CaveFloor; }
        // Anomaly center
        z.objects[8][15]=Rift;
        z.objects[7][15]=Guide; // Shadow of Antagonist
        z.objects[5][10]=Rock; z.objects[5][20]=Rock;
        z.objects[12][9]=Rock; z.objects[12][21]=Rock;
        z.objects[10][12]=Fire; z.objects[10][18]=Fire;
    }
}
}
