import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Chart from 'react-apexcharts';
import { API_URL } from '../Config/Config';

const TreemapCasas = () => {
  const [chartData, setChartData] = useState({
    series: [],
    options: {
      chart: {
        type: 'bar',
        height: 500,
        toolbar: {
          show: true, // Mostrar la barra de herramientas
          tools: {
            download: true, // Habilitar el botón de descarga
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true
          },
          export: {
            csv: {
              filename: 'registros-por-casa',
              columnDelimiter: ',',
              headerCategory: 'Casa',
              headerValue: 'Registros',
              dateFormatter(timestamp) {
                return new Date(timestamp).toDateString()
              }
            },
            svg: {
              filename: 'registros-por-casa',
            },
            png: {
              filename: 'registros-por-casa',
            }
          },
        }
      },
      title: {
        text: 'Registros por Casa',
        align: 'center',
        style: { fontSize: '18px', fontWeight: 'bold' },
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '70%',
          distributed: true,
          dataLabels: {
            position: 'top',
          },
        },
      },
      colors: [
        '#008FFB', '#00E396', '#FEB019', '#FF4560', '#775DD0',
        '#546E7A', '#26A69A', '#D10CE8', '#8B5CF6', '#34D399',
        '#F43F5E', '#F97316', '#FACC15', '#4ADE80', '#60A5FA'
      ],
      dataLabels: {
        enabled: true,
        formatter: function(val) {
          return val;
        },
        offsetY: -20,
        style: {
          fontSize: '12px',
          fontWeight: 'bold',
          colors: ["#000"]
        }
      },
      stroke: {
        width: 1,
        colors: ['#fff']
      },
      grid: {
        show: true,
        borderColor: '#90A4AE',
        strokeDashArray: 0,
        position: 'back',
        xaxis: {
          lines: {
            show: false
          }
        },
        yaxis: {
          lines: {
            show: true
          }
        },
      },
      xaxis: {
        categories: [],
        labels: {
          formatter: function(val) {
            return 'Casa ' + val;
          },
          style: {
            fontSize: '12px',
            fontWeight: 400,
          },
          rotate: -45,
          rotateAlways: false,
        },
        title: {
          text: 'Casa'
        },
        axisBorder: {
          show: true,
        },
        axisTicks: {
          show: true,
        },
      },
      yaxis: {
        title: {
          text: 'Número de Registros'
        },
        labels: {
          formatter: function(val) {
            // Formateamos números grandes para hacerlos más legibles
            if (val >= 1000) {
              return (val / 1000).toFixed(val >= 10000 ? 0 : 1) + 'K';
            }
            return val;
          }
        }
      },
      tooltip: {
        y: {
          formatter: function(value) {
            return value + ' registros';
          }
        }
      },
      legend: {
        show: false
      }
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`${API_URL}/getGraficoCasas`);
        const data = response.data.chartData;
  
        // Ordenar datos de mayor a menor
        data.sort((a, b) => b.registros - a.registros);
        
        // Extraer categorías (casas) y valores (registros)
        const categories = data.map(item => item.casa);
        const values = data.map(item => item.registros);
        
        setChartData((prev) => ({
          ...prev,
          series: [{
            name: 'Registros',
            data: values
          }],
          options: {
            ...prev.options,
            xaxis: {
              ...prev.options.xaxis,
              categories: categories
            }
          }
        }));
      } catch (error) {
        console.error('Error al obtener datos del gráfico:', error);
      }
    };
  
    fetchData();
  }, []);

  return (
    <div>
      <Chart
        options={chartData.options}
        series={chartData.series}
        type="bar"
        height={500}
      />
    </div>
  );
};

export default TreemapCasas;