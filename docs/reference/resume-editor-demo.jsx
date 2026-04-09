import { useState } from 'react'

const mockCvState = {
  resumo: 'Engenheiro de Dados e Business Intelligence com experiencia em pipelines ETL/ELT escalaveis e dashboards estrategicos.',
  experiencias: [
    {
      id: '1',
      cargo: 'Business Intelligence & Engenheiro de Dados',
      empresa: 'Case New Holland',
      periodo: '2023 - Atual',
      descricao: 'Pipelines ETL/ELT com Azure Databricks, PySpark e dashboards em Power BI.',
    },
  ],
  formacao: [
    {
      id: '1',
      curso: 'Analise e Desenvolvimento de Sistemas',
      instituicao: 'Bacharelado - Em andamento',
    },
  ],
  habilidades: ['Azure Databricks', 'PySpark', 'Power BI', 'SQL', 'Python'],
}

export default function ResumeEditorDemoReference() {
  const [isOpen, setIsOpen] = useState(true)
  const [cv] = useState(mockCvState)

  if (!isOpen) {
    return null
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 24,
        background: '#f0ede6',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div
        style={{
          margin: '0 auto',
          width: 'min(640px, 92vw)',
          maxHeight: '85vh',
          overflow: 'hidden',
          borderRadius: 16,
          border: '1px solid #e8e5dc',
          background: '#fffef9',
          boxShadow: '0 24px 60px rgba(44,42,37,0.12)',
        }}
      >
        <div style={{ borderBottom: '1px solid #e8e5dc', padding: '20px 20px 16px' }}>
          <h2 style={{ margin: 0, color: '#2c2a25', fontSize: 18 }}>Editar curriculo</h2>
          <p style={{ margin: '6px 0 0', color: '#9c9789', fontSize: 12 }}>
            Modifique as secoes e gere um novo PDF
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e8e5dc', padding: '12px 20px' }}>
          {['Resumo', 'Experiencia', 'Formacao', 'Habilidades'].map((label, index) => (
            <button
              key={label}
              type="button"
              style={{
                border: 0,
                borderBottom: index === 0 ? '2px solid #b8860b' : '2px solid transparent',
                background: 'transparent',
                color: index === 0 ? '#2c2a25' : '#9c9789',
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ maxHeight: '52vh', overflowY: 'auto', padding: 20 }}>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 8px', color: '#2c2a25', fontSize: 14 }}>Resumo profissional</h3>
            <textarea
              value={cv.resumo}
              readOnly
              rows={5}
              style={{
                width: '100%',
                resize: 'none',
                borderRadius: 12,
                border: '1px solid #e0ddd4',
                background: '#f7f5ef',
                color: '#2c2a25',
                padding: 12,
                lineHeight: 1.6,
              }}
            />
            <p style={{ margin: '6px 0 0', textAlign: 'right', color: '#9c9789', fontSize: 12 }}>
              {cv.resumo.length} caracteres
            </p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 8px', color: '#2c2a25', fontSize: 14 }}>Experiencias</h3>
            {cv.experiencias.map((item) => (
              <div
                key={item.id}
                style={{
                  marginBottom: 12,
                  borderRadius: 12,
                  border: '1px solid #e0ddd4',
                  background: '#f7f5ef',
                  padding: 16,
                }}
              >
                <p style={{ margin: 0, color: '#2c2a25', fontSize: 14, fontWeight: 700 }}>{item.cargo}</p>
                <p style={{ margin: '6px 0', color: '#9c9789', fontSize: 12 }}>
                  {item.empresa} | {item.periodo}
                </p>
                <p style={{ margin: 0, color: '#5c5647', fontSize: 12, lineHeight: 1.6 }}>{item.descricao}</p>
              </div>
            ))}
          </div>

          <div>
            <h3 style={{ margin: '0 0 8px', color: '#2c2a25', fontSize: 14 }}>Habilidades</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {cv.habilidades.map((skill) => (
                <span
                  key={skill}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 8,
                    border: '1px solid #e0ddd4',
                    background: '#f0ede6',
                    color: '#5c5647',
                    padding: '6px 10px',
                    fontSize: 12,
                  }}
                >
                  {skill}
                  <span style={{ opacity: 0.6 }}>x</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            borderTop: '1px solid #e8e5dc',
            padding: '14px 20px',
          }}
        >
          <span style={{ color: '#9c9789', fontSize: 12 }}>As alteracoes geram um novo PDF</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                borderRadius: 10,
                border: '1px solid #e0ddd4',
                background: 'transparent',
                color: '#2c2a25',
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              style={{
                borderRadius: 10,
                border: 0,
                background: '#b8860b',
                color: '#fff',
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Salvar e gerar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
