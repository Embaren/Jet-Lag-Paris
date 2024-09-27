import {rgba} from "/scripts/utils.js";

// Returns style associated with a transport line
export function getTransportStyle(lineWidth, radius, shape){
    return (color, highlighted=false)=>{
        const highlightFactor=highlighted ? 2 : 1;
        return function(feature,resolution){
            const type = feature.get("type");
            if (type=="line"){
                return new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: color,
                        width: lineWidth * highlightFactor,
                    }),
                });
            }
            else if(type=="station"){
                const team = feature.get('team');
                const teamColor = rgba(...feature.get('team_color'));
                
                if(shape=="circle"){
                    return new ol.style.Style({
                        image: new ol.style.Circle({
                            fill: new ol.style.Fill({
                                color: teamColor,
                            }),
                            stroke: new ol.style.Stroke({
                                color: color,
                                width: lineWidth,
                            }),
                            radius:radius * highlightFactor,
                        }),
                    });
                }
                else{
                    return new ol.style.Style({
                        image: new ol.style.RegularShape({
                            fill: new ol.style.Fill({
                                color: teamColor,
                            }),
                            stroke: new ol.style.Stroke({
                                color: color,
                                width: lineWidth,
                            }),
                            radius:radius * highlightFactor,
                            angle:(shape=="square")?Math.PI/4:0,
                            points:(shape=="square")?4:3,
                        }),
                    });
                }
            }
        }
    }
}

export function getPinStyle(outerColor, innerColor, outerRadius, InnerRadius, lineWidth, lineColor){
    const ratio = 2;
    const alpha = Math.asin(1/ratio);
    return new ol.style.Style({
        renderer: (coordinates, state)=>{
            const [x,y] = coordinates;
            const ctx = state.context;
            
            const [x_c, y_c] = [x, y-ratio*outerRadius];
            
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.arc(x_c,y_c,outerRadius,-Math.PI-alpha,0+alpha,false);
            ctx.lineTo(x, y)
            
            ctx.fillStyle=outerColor;
            ctx.fill();
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle=lineColor;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(x_c,y_c,InnerRadius,0,2*Math.PI,false);
            ctx.fillStyle=innerColor;
            ctx.fill();
            ctx.strokeStyle=lineColor;
            ctx.stroke();
            
        },
    });
}

export function addressStyle(color, highlighted=false){
    const baseRadius = 40;
    const baseInnerRadius = 16;
    const lineWidth = 10;
    const highlightFactor=highlighted ? 2 : 1;
    return function(feature,resolution){
        const teamColor = rgba(...feature.get('team_color'));
        const ownerColor = rgba(...feature.get('owner_color'));
        
        return getPinStyle(ownerColor,teamColor,baseRadius*highlightFactor,baseInnerRadius*highlightFactor,lineWidth*highlightFactor,color);
    }
}

export function getClientStyle(client){
    const radius = 30;
    const lineWidth = 15;
    const lineColor = 'white';
    return (color, highlighted=false)=>{
        return new ol.style.Style({
            renderer: (coordinates, state)=>{
                const [x,y] = coordinates;
                const ctx = state.context;
                
                if(client?.location?.current?.heading){
                    const alpha = client?.location.current.heading*Math.PI/180;
                    const cos_alpha = Math.cos(alpha);
                    const sin_alpha = Math.sin(alpha);
                    ctx.beginPath();
                    ctx.moveTo(x-radius*cos_alpha,y-radius*sin_alpha);
                    ctx.lineTo(x+2*radius*sin_alpha,y-2*radius*cos_alpha);
                    ctx.lineTo(x+radius*cos_alpha,y+radius*sin_alpha);
                    ctx.fillStyle=lineColor;
                    ctx.fill();
                    ctx.lineWidth = lineWidth;
                    ctx.strokeStyle=lineColor;
                    ctx.stroke();
                }
                
                ctx.beginPath();
                ctx.arc(x,y,radius,0,2*Math.PI,false);
                
                ctx.fillStyle=color;
                ctx.fill();
                ctx.lineWidth = lineWidth;
                ctx.strokeStyle=lineColor;
                ctx.stroke();
            },
        });
    }
}

export function getPlayerStyle(img,teamColor){
    
    const baseRadius = 30;
    const lineWidth = 10;
    
    return (color=null, highlighted=false)=>{
        
        const highlightFactor = highlighted ? 2 : 1;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const radius = baseRadius*highlightFactor;
        const size = 2*radius+Math.ceil(lineWidth/2)
        canvas.width = size;
        canvas.height = size;
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(size/2,size/2, radius, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, lineWidth/2, lineWidth/2, 2*radius, 2*radius);
        
        ctx.restore();
        ctx.beginPath();
        ctx.arc(size/2, size/2, radius, 0, 2*Math.PI, false);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color ? color : teamColor;
        ctx.stroke();

        //create new openlayers icon style from canvas
        return new ol.style.Style({
            image: new ol.style.Icon({
                img: canvas,
                size: [canvas.width, canvas.height]
            })
        });
        
    }
}