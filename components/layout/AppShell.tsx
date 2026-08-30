'use client';
import {useState} from 'react';import {Sidebar} from './Sidebar';import {Topbar} from './Topbar';import {BottomNav} from './BottomNav';
export function AppShell({children}:{children:React.ReactNode}){const[open,setOpen]=useState(false);return <div className="app-shell"><Sidebar open={open} onClose={()=>setOpen(false)}/><div className="main"><Topbar onMenu={()=>setOpen(true)}/><main className="content">{children}</main></div><BottomNav/></div>}
