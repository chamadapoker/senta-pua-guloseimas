import { AppLayout } from '../components/AppLayout';
import { Link } from 'react-router-dom';

export function PoliticaPrivacidade() {
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto py-6 animate-fade-in">
        <h1 className="font-display text-3xl text-azul tracking-wider mb-2">POLÍTICA DE PRIVACIDADE</h1>
        <p className="text-xs text-texto-fraco mb-6">Última atualização: 14/04/2026</p>

        <div className="bg-white rounded-xl border border-borda p-6 space-y-5 text-sm leading-relaxed">
          <section>
            <h2 className="font-display text-lg text-azul tracking-wider mb-2">1. Quem somos</h2>
            <p>
              O aplicativo <strong>Senta Pua</strong> é de uso interno do <strong>Esquadrão 1/10 GpAv</strong>, utilizado
              para gerenciar cantinas, loja, caixinha do café e ximbocas. Os dados coletados servem exclusivamente
              às atividades internas do esquadrão.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-azul tracking-wider mb-2">2. Dados que coletamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Identificação:</strong> email, trigrama (nome de guerra), SARAM, categoria militar (Oficial / Graduado / Praça)</li>
              <li><strong>Contato:</strong> número de WhatsApp</li>
              <li><strong>Foto de perfil</strong> (opcional, fornecida por você)</li>
              <li><strong>Esquadrão de origem</strong> (apenas para visitantes de outros esquadrões)</li>
              <li><strong>Histórico de pedidos</strong> nas cantinas, loja, café e ximbocas</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg text-azul tracking-wider mb-2">3. Para que usamos seus dados</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Identificar você na realização de compras nas cantinas e loja</li>
              <li>Registrar assinaturas e pagamentos da caixinha do café</li>
              <li>Enviar lembretes e comprovantes via WhatsApp</li>
              <li>Emitir extrato financeiro quando solicitado</li>
              <li>Apenas o administrador do sistema tem acesso aos seus dados</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg text-azul tracking-wider mb-2">4. Compartilhamento</h2>
            <p>
              <strong>Seus dados não são compartilhados com terceiros.</strong> Ficam restritos ao admin do sistema
              (responsável pela cantina do esquadrão) e aos servidores da Cloudflare onde o app é hospedado,
              com conexão criptografada (HTTPS).
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-azul tracking-wider mb-2">5. Segurança</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Suas senhas são armazenadas com criptografia <strong>PBKDF2</strong> + salt (não ficam em texto puro)</li>
              <li>O login usa tokens <strong>JWT</strong> com expiração automática</li>
              <li>Todo o tráfego é <strong>HTTPS</strong> (SSL)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg text-azul tracking-wider mb-2">6. Seus direitos (LGPD)</h2>
            <p className="mb-2">Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), você pode:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Ver</strong> todos os seus dados cadastrados em <Link to="/perfil" className="text-azul underline">Meu Perfil</Link></li>
              <li><strong>Editar</strong> WhatsApp, SARAM e foto a qualquer momento</li>
              <li><strong>Excluir sua conta completamente</strong> (botão "Excluir minha conta" em <Link to="/perfil" className="text-azul underline">Meu Perfil</Link>)</li>
              <li><strong>Solicitar esclarecimentos</strong> sobre o tratamento dos seus dados</li>
            </ul>
            <p className="mt-2 text-xs text-texto-fraco">
              Para exercer qualquer direito, você pode entrar em contato com o admin da cantina pelo WhatsApp.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-azul tracking-wider mb-2">7. Retenção</h2>
            <p>
              Seus dados permanecem ativos enquanto sua conta estiver ativa. Se você excluir sua conta,
              <strong> todos os dados pessoais são removidos</strong>, incluindo histórico de pedidos,
              participações em ximbocas e assinaturas de café.
            </p>
            <p className="mt-2">
              Visitantes têm acesso por <strong>30 dias</strong> após o cadastro. Se o prazo expirar, o acesso é bloqueado,
              mas os dados permanecem no sistema (para conciliação financeira de pedidos antigos) até que você solicite
              exclusão.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-azul tracking-wider mb-2">8. Cookies</h2>
            <p>
              Usamos armazenamento local (<code>localStorage</code>) apenas para manter você logado (token JWT)
              e a preferência do sidebar. Não usamos cookies de rastreamento nem análise de terceiros.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-azul tracking-wider mb-2">9. Consentimento</h2>
            <p>
              Ao criar sua conta, você confirma que leu esta política e concorda com a coleta dos dados acima
              para as finalidades descritas. Você pode revogar o consentimento a qualquer momento excluindo sua conta.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg text-azul tracking-wider mb-2">10. Atualizações</h2>
            <p>
              Esta política pode ser atualizada. Alterações significativas serão comunicadas na tela de login ou
              por WhatsApp.
            </p>
          </section>
        </div>

        <p className="text-center text-xs text-texto-fraco mt-6">
          <Link to="/" className="hover:underline">← Voltar ao início</Link>
        </p>
      </div>
    </AppLayout>
  );
}
