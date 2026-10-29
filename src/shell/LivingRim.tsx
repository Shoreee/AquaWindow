import {forwardRef} from 'react';
/** Shared optical material: white tissue, soft bloom, restrained dispersion; never a dashed wire. */
export const LivingRim=forwardRef<SVGGElement,{path:string;frontClass?:string;opacity?:number}>(function LivingRim({path,frontClass='',opacity=1},ref){return <g ref={ref} className="living-edge" opacity={opacity}>
 <path data-living-path d={path} className="living-edge-bloom"/>
 <path data-living-path d={path} className="living-edge-cool"/>
 <path data-living-path d={path} className="living-edge-warm"/>
 <path data-living-path d={path} className={`living-edge-core ${frontClass}`}/>
 </g>});
