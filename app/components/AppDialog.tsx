'use client';
import {useEffect,useRef,type ReactNode} from 'react';
export default function AppDialog({open,onClose,label,className='',children}:{open:boolean;onClose:()=>void;label:string;className?:string;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;if(open&&!dialog?.open)dialog?.showModal();if(!open&&dialog?.open)dialog.close();},[open]);
 return <dialog ref={ref} className={`app-dialog ${className}`} aria-label={label} onCancel={e=>{e.preventDefault();onClose();}}>{children}</dialog>;
}
