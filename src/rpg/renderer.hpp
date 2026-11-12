#pragma once
#include <stdint.h>
#include "gen/atlas.hpp"

namespace tj {
constexpr int Width=480, Height=320, Tile=16;
inline uint32_t rgba(unsigned rgb, unsigned a=255) {
    return ((rgb & 255)<<16) | (rgb & 0xff00) | ((rgb>>16)&255) | (a<<24);
}
// Atlas pixels are uploaded by JS from public/art/rpg/atlas.png (RGBA bytes).
uint32_t atlasPixels[art::AtlasW*art::AtlasH];
int atlasReady=0;

struct Renderer {
    uint32_t pixels[Width*Height]{};
    uint8_t light[Width*Height*3];
    int camX=0, camY=0;
    inline void blend(uint32_t& dst,uint32_t src,unsigned alpha) {
        if(alpha>=255){dst=src|0xff000000u;return;}
        unsigned ia=255-alpha;
        unsigned r=((src&255)*alpha+(dst&255)*ia)>>8;
        unsigned g=(((src>>8)&255)*alpha+((dst>>8)&255)*ia)>>8;
        unsigned b=(((src>>16)&255)*alpha+((dst>>16)&255)*ia)>>8;
        dst=r|(g<<8)|(b<<16)|0xff000000u;
    }
    void pixel(int x,int y,uint32_t color) {
        if(x<0||y<0||x>=Width||y>=Height) return;
        unsigned alpha=color>>24; if(!alpha) return;
        blend(pixels[y*Width+x],color,alpha);
    }
    void rect(int x,int y,int w,int h,uint32_t color) {
        int x0=x<0?0:x,y0=y<0?0:y,x1=x+w>Width?Width:x+w,y1=y+h>Height?Height:y+h;
        unsigned alpha=color>>24; if(!alpha) return;
        for(int yy=y0;yy<y1;++yy)for(int xx=x0;xx<x1;++xx)blend(pixels[yy*Width+xx],color,alpha);
    }
    void ellipse(int x,int y,int rx,int ry,uint32_t color) {
        for(int yy=-ry;yy<=ry;++yy)for(int xx=-rx;xx<=rx;++xx)
            if(xx*xx*ry*ry+yy*yy*rx*rx<=rx*rx*ry*ry)pixel(x+xx,y+yy,color);
    }
    // Blit an atlas rectangle at screen position (sx,sy) = top-left. mode: 1 flip, 2 white flash.
    void blit(int ax,int ay,int w,int h,int sx,int sy,bool flip,unsigned alpha=255,int flash=0,uint32_t tint=0) {
        if(!atlasReady||ax<0) return;
        int x0=sx<0?-sx:0,y0=sy<0?-sy:0,x1=sx+w>Width?Width-sx:w,y1=sy+h>Height?Height-sy:h;
        for(int y=y0;y<y1;++y) {
            const uint32_t* row=atlasPixels+(ay+y)*art::AtlasW+ax;
            uint32_t* out=pixels+(sy+y)*Width+sx;
            for(int x=x0;x<x1;++x) {
                uint32_t s=row[flip?w-1-x:x];
                unsigned a=s>>24; if(!a) continue;
                if(flash) {
                    unsigned r=(s&255)+flash,g=((s>>8)&255)+flash,b=((s>>16)&255)+flash;
                    s=(r>255?255:r)|((g>255?255:g)<<8)|((b>255?255:b)<<16)|(s&0xff000000u);
                }
                if(tint) {
                    unsigned t=tint>>24;
                    unsigned r=((s&255)*(255-t)+(tint&255)*t)>>8,g=(((s>>8)&255)*(255-t)+((tint>>8)&255)*t)>>8,b=(((s>>16)&255)*(255-t)+((tint>>16)&255)*t)>>8;
                    s=r|(g<<8)|(b<<16)|(s&0xff000000u);
                }
                blend(out[x],s,alpha>=255?a:(a*alpha)>>8);
            }
        }
    }
    // Sprite by id, anchored at world position (wx,wy).
    void sprite(int id,int wx,int wy,bool flip=false,unsigned alpha=255,int flash=0) {
        const auto& s=art::spr[id];
        int ax=flip?s.w-1-s.ax:s.ax;
        blit(s.x,s.y,s.w,s.h,wx-camX-ax,wy-camY-s.ay,flip,alpha,flash);
    }
    void tile(int id,int wx,int wy) {
        const auto& s=art::spr[id];
        blit(s.x,s.y,s.w,s.h,wx-camX,wy-camY,false);
    }
    // Animated character frame: sheet, anim, view row, frame column, anchored at feet.
    bool frame(int sheet,int anim,int view,int f,int wx,int wy,bool flip,unsigned alpha=255,int flash=0,uint32_t tint=0) {
        const auto& sh=art::sheets[sheet];
        auto b=sh.anim[anim];
        if(b.x<0)return false;
        int n=art::animFrames[anim]; if(f>=n)f=n-1; if(f<0)f=0;
        int ax=flip?sh.cell-1-sh.ax:sh.ax;
        blit(b.x+f*sh.cell,b.y+view*sh.cell,sh.cell,sh.cell,wx-camX-ax,wy-camY-sh.ay,flip,alpha,flash,tint);
        return true;
    }
    // Light: ambient multiply with additive coloured light pools.
    void lightBegin(int r,int g,int b) {
        for(int i=0;i<Width*Height;++i){light[i*3]=r;light[i*3+1]=g;light[i*3+2]=b;}
    }
    void lightAdd(int wx,int wy,int radius,int r,int g,int b) {
        int cx=wx-camX,cy=wy-camY;
        int x0=cx-radius,x1=cx+radius,y0=cy-radius,y1=cy+radius;
        if(x1<0||y1<0||x0>=Width||y0>=Height)return;
        if(x0<0)x0=0;if(y0<0)y0=0;if(x1>=Width)x1=Width-1;if(y1>=Height)y1=Height-1;
        int r2=radius*radius;
        for(int y=y0;y<=y1;++y)for(int x=x0;x<=x1;++x) {
            int dx=x-cx,dy=(y-cy)*4/3,d2=dx*dx+dy*dy;
            if(d2>=r2)continue;
            int f=255-d2*255/r2; f=f*f>>8;
            uint8_t* l=light+(y*Width+x)*3;
            int nr=l[0]+(r*f>>8),ng=l[1]+(g*f>>8),nb=l[2]+(b*f>>8);
            l[0]=nr>255?255:nr;l[1]=ng>255?255:ng;l[2]=nb>255?255:nb;
        }
    }
    void lightShade(int x,int y,int w,int h,int amount) { // Darken a region (cloud shadows).
        for(int yy=y;yy<y+h;++yy)for(int xx=x;xx<x+w;++xx) {
            if(xx<0||yy<0||xx>=Width||yy>=Height)continue;
            uint8_t* l=light+(yy*Width+xx)*3;
            for(int k=0;k<3;++k){int v=l[k]-amount;l[k]=v<0?0:v;}
        }
    }
    void lightApply() {
        for(int i=0;i<Width*Height;++i) {
            uint32_t p=pixels[i];const uint8_t* l=light+i*3;
            // 200 = neutral; values above brighten (fire glow), below darken.
            unsigned r=(p&255)*l[0]/200,g=((p>>8)&255)*l[1]/200,b=((p>>16)&255)*l[2]/200;
            pixels[i]=(r>255?255:r)|((g>255?255:g)<<8)|((b>255?255:b)<<16)|0xff000000u;
        }
    }
};
}
