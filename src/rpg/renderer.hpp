#pragma once
#include <stdint.h>

namespace tj {
constexpr int Width=480, Height=320, Tile=16, Cols=30, Rows=20;
inline uint32_t rgba(unsigned rgb, unsigned a=255) {
    return ((rgb & 255)<<16) | (rgb & 0xff00) | ((rgb>>16)&255) | (a<<24);
}
struct Renderer {
    uint32_t pixels[Width*Height]{};
    void pixel(int x,int y,uint32_t color) {
        if(x<0||y<0||x>=Width||y>=Height) return;
        unsigned alpha=color>>24;
        if(alpha==0) return;
        uint32_t &dst=pixels[y*Width+x];
        if(alpha==255) { dst=color; return; }
        unsigned r=((color&255)*alpha+(dst&255)*(255-alpha))/255;
        unsigned g=(((color>>8)&255)*alpha+((dst>>8)&255)*(255-alpha))/255;
        unsigned b=(((color>>16)&255)*alpha+((dst>>16)&255)*(255-alpha))/255;
        dst=r|(g<<8)|(b<<16)|0xff000000u;
    }
    void rect(int x,int y,int w,int h,uint32_t color) {
        for(int yy=y;yy<y+h;++yy)for(int xx=x;xx<x+w;++xx)pixel(xx,yy,color);
    }
    void ellipse(int x,int y,int rx,int ry,uint32_t color) {
        for(int yy=-ry;yy<=ry;++yy)for(int xx=-rx;xx<=rx;++xx)
            if(xx*xx*ry*ry+yy*yy*rx*rx<=rx*rx*ry*ry)pixel(x+xx,y+yy,color);
    }
    void sprite(int x,int y,const char* data,int w,int h,const uint32_t* palette,bool flip=false) {
        for(int yy=0;yy<h;++yy)for(int xx=0;xx<w;++xx) {
            char c=data[yy*w+xx];
            if(c!='.')pixel(x+(flip?w-1-xx:xx),y+yy,palette[c-'0']);
        }
    }
};
}
