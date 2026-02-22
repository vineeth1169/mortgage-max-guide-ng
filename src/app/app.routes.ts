import { Routes } from '@angular/router';
import { GuidePageComponent } from './features/guide/pages/guide-page/guide-page.component';
import { PoolAssistantPageComponent } from './features/pool-assistant/pages/pool-assistant-page/pool-assistant-page.component';
import { RulesManagerComponent } from './features/admin/pages/rules-manager/rules-manager.component';

export const routes: Routes = [
  { path: '', redirectTo: 'guide/4100', pathMatch: 'full' },
  { path: 'guide/:sectionId', component: GuidePageComponent },
  { path: 'pool-assistant', component: PoolAssistantPageComponent },
  { path: 'admin/rules', component: RulesManagerComponent },
  { path: '**', redirectTo: 'guide/4100' },
];
