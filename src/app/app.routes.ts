import { Routes } from '@angular/router';
import { GuidePageComponent } from './features/guide/pages/guide-page/guide-page.component';
import { PoolAssistantPageComponent } from './features/pool-assistant/pages/pool-assistant-page/pool-assistant-page.component';
import { RulesManagerComponent } from './features/admin/pages/rules-manager/rules-manager.component';
import { BYOLTabComponent } from './features/byol/components/byol-tab/byol-tab.component';

export const routes: Routes = [
  { path: '', redirectTo: 'guide/4100', pathMatch: 'full' },
  { path: 'guide/:sectionId', component: GuidePageComponent },
  { path: 'bring-your-own-loans', component: BYOLTabComponent },
  { path: 'pool-assistant', component: PoolAssistantPageComponent },
  { path: 'admin/rules', component: RulesManagerComponent },
  { path: '**', redirectTo: 'guide/4100' },
];
